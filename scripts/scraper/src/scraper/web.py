"""HTTP fetching and Shopify JSON access.

We read the Shopify storefront's `collections/<handle>/products.json` endpoint —
a first-class JSON API returning full product objects (variants, options,
images) — instead of scraping HTML. It's stable across theme/markup changes and
already structured the way we need for recreating variants.

`fetch` throttles per host (not globally) so different sites proceed in
parallel; that per-host spacing is what keeps concurrent workers polite.
"""

import logging
import threading
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from .config import (
    CDN_DELAY_SECONDS,
    CDN_HOSTS,
    GLOBAL_DELAY_SECONDS,
    REQUEST_DELAY_SECONDS,
    RETRY_STATUS,
    USER_AGENT,
)

log = logging.getLogger("scraper.web")


class _Throttle:
    """Space requests out per host *and* overall.

    The per-host interval is what keeps us polite to any one shop; the global
    one exists because Shopify storefronts and their CDN share rate limiting by
    client IP, so nine well-behaved producers still add up to one impolite
    client. Slots are reserved under a lock and the blocking sleep happens
    outside it, so threads queue rather than pile up.
    """

    def __init__(self, per_host: float, global_gap: float):
        self.per_host = per_host
        self.global_gap = global_gap
        self._lock = threading.Lock()
        self._next: dict[str, float] = {}
        self._next_any = 0.0

    def wait(self, host: str) -> None:
        cdn = host.endswith(CDN_HOSTS)
        with self._lock:
            now = time.monotonic()
            floor = 0.0 if cdn else self._next_any
            slot = max(now, self._next.get(host, 0.0), floor)
            self._next[host] = slot + (CDN_DELAY_SECONDS if cdn else self.per_host)
            if not cdn:
                self._next_any = slot + self.global_gap
        delay = slot - time.monotonic()
        if delay > 0:
            time.sleep(delay)

    def penalise(self, host: str, seconds: float) -> None:
        """After a 429, hold the whole client back — the limit is rarely just
        for the host that reported it."""
        with self._lock:
            now = time.monotonic()
            self._next[host] = max(self._next.get(host, 0.0), now + seconds)
            self._next_any = max(self._next_any, now + seconds / 2)


_throttle = _Throttle(REQUEST_DELAY_SECONDS, GLOBAL_DELAY_SECONDS)


def fetch(url: str, attempts: int = 5) -> requests.Response:
    """GET, throttled per host, backing off exponentially on rate limiting.

    Smaller shops throttle hard, and a listing request costs us a whole category
    if it fails, so we wait rather than give up — honouring `Retry-After` when
    the server tells us how long.
    """
    host = urlparse(url).netloc
    for attempt in range(1, attempts + 1):
        _throttle.wait(host)
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        if resp.status_code in RETRY_STATUS and attempt < attempts:
            retry_after = resp.headers.get("Retry-After")
            wait = float(retry_after) if (retry_after or "").isdigit() else min(90, 8 * 2 ** (attempt - 1))
            log.info("  got %d for %s, retrying in %gs", resp.status_code, url, wait)
            _throttle.penalise(host, wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise AssertionError("unreachable")


def collection_products(site, category: str, budget: int, max_pages: int, page_size: int = 100):
    """Yield full Shopify product objects for a category, in collection order.

    Pages lazily: strict filtering rejects most of what a collection lists, so we
    have to look at far more products than we keep — but only as far as the
    caller actually consumes, and never past `budget` candidates or `max_pages`
    requests.
    """
    handle = site.collections[category]
    seen = 0
    for page in range(1, max_pages + 1):
        url = urljoin(site.base_url,
                      f"/collections/{handle}/products.json?limit={page_size}&page={page}")
        log.info("Fetching %s", url)
        products = fetch(url).json().get("products", [])
        if not products:
            return
        for raw in products:
            yield raw
            seen += 1
            if seen >= budget:
                return


def html_to_text(html: str) -> str:
    """Shopify `body_html` -> plain text for descriptions/classification."""
    return BeautifulSoup(html or "", "lxml").get_text(" ", strip=True)


def download_images(images: list[dict], dest: Path) -> list[dict]:
    """Download product images; return per-image {file, src, variant_ids}. The
    variant_ids let a later Shopify import re-attach each image to its variants."""
    dest.mkdir(parents=True, exist_ok=True)
    saved: list[dict] = []
    for i, image in enumerate(images, start=1):
        src = image.get("src") or ""
        if src.startswith("//"):
            src = "https:" + src
        ext = Path(urlparse(src).path).suffix.lower() or ".jpg"
        filename = f"{i:02d}{ext}"
        try:
            resp = fetch(src)
        except requests.RequestException as exc:
            log.warning("  image %s failed: %s", src, exc)
            continue
        (dest / filename).write_bytes(resp.content)
        saved.append({"file": filename, "src": src, "variant_ids": image.get("variant_ids", [])})
    return saved
