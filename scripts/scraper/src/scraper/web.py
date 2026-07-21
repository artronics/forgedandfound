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

from .config import REQUEST_DELAY_SECONDS, RETRY_STATUS, USER_AGENT

log = logging.getLogger("scraper.web")


class _HostThrottle:
    """Enforce a minimum interval between requests to each host, without
    blocking requests to other hosts. Reserving the next slot is done under a
    lock; the (possibly) blocking sleep happens outside it."""

    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._next: dict[str, float] = {}

    def wait(self, host: str) -> None:
        with self._lock:
            now = time.monotonic()
            slot = max(now, self._next.get(host, 0.0))
            self._next[host] = slot + self.min_interval
        delay = slot - time.monotonic()
        if delay > 0:
            time.sleep(delay)


_throttle = _HostThrottle(REQUEST_DELAY_SECONDS)


def fetch(url: str, attempts: int = 4) -> requests.Response:
    """GET, throttled per host, with backoff on rate limiting (429/5xx)."""
    host = urlparse(url).netloc
    for attempt in range(1, attempts + 1):
        _throttle.wait(host)
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        if resp.status_code in RETRY_STATUS and attempt < attempts:
            wait = 5 * attempt
            log.info("  got %d for %s, retrying in %ds", resp.status_code, url, wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise AssertionError("unreachable")


def collection_products(site: dict, category: str, limit: int) -> list[dict]:
    """Full Shopify product objects for a category, in collection order."""
    handle = site["collections"][category]
    url = urljoin(site["base_url"], f"/collections/{handle}/products.json?limit={limit}")
    log.info("Fetching %s", url)
    return fetch(url).json().get("products", [])[:limit]


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
