"""
Scrape real jewellery product data to seed a Shopify dev shop.

For each product we save:
    data/products/<category>/<style>/<id>/product.json
    data/products/<category>/<style>/<id>/<photo files>

- Product URLs are collected from the site's category (collection) listing page.
- Product information is extracted from the product page by a local LLM
  (scrapegraphai SmartScraperGraph + Ollama). The LLM also assigns the style.
- Photos are taken from the product page's media gallery (no classifier).

First run scope: one website (dlouise.com), one category (ring), 10 products.
"""

import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

os.environ.setdefault("SCRAPEGRAPHAI_TELEMETRY_ENABLED", "false")

from scrapegraphai.graphs import SmartScraperGraph  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scraper")

websites = [
    "https://www.monicavinader.com/",
    "https://mejuri.com/gb/en?",
    "https://dlouise.com/"
]

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "products"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
)

OLLAMA_BASE_URL = "http://localhost:11434"

GRAPH_CONFIG = {
    "llm": {
        "model": "ollama/qwen2.5:7b",
        "temperature": 0,
        "format": "json",
        "base_url": OLLAMA_BASE_URL,
        "model_tokens": 8192,
        "num_ctx": 16384,
    },
    "headless": True,
    "verbose": False,
}

# Per-site config: how to find category listing pages and the photo gallery.
SITES = {
    "dlouise.com": {
        "base_url": "https://dlouise.com",
        # our category name -> site collection path
        "categories": {
            "ring": "/collections/rings",
            "necklace": "/collections/necklaces",
            "bracelet": "/collections/bracelets",
            "earings": "/collections/earrings",
        },
        "product_link_re": re.compile(r"/products/[a-z0-9-]+$"),
        "gallery_selector": ".product__slides img",
        # main product info block; the rest of the page (nav, footer,
        # recommendation carousels) confuses the LLM and is dropped
        "content_selector": ".product__content",
    },
}


class ProductInfo(BaseModel):
    name: str = Field(description="Product name")
    description: str = Field(description="Full product description text")
    price: float | None = Field(default=None, description="Numeric price of the default variant")
    currency: str | None = Field(default=None, description="ISO currency code, e.g. GBP")
    style: str = Field(
        description=(
            "Single short style label for this piece of jewellery, lowercase, "
            "e.g. signet, stacking, tennis, dome, chain, pearl, huggie, stud, charm"
        )
    )
    materials: list[str] = Field(default_factory=list, description="Materials, e.g. gold vermeil, sterling silver")
    colors: list[str] = Field(default_factory=list, description="Available colours/finishes")
    gemstones: list[str] = Field(default_factory=list, description="Gemstones if any")
    sizes: list[str] = Field(default_factory=list, description="Available sizes if any")
    tags: list[str] = Field(default_factory=list, description="Other descriptive tags, e.g. waterproof, engravable")


EXTRACT_PROMPT = (
    "Extract the product information for the jewellery product on this page. "
    "Only describe the product itself (name, description, price, style, materials, "
    "colours, gemstones, sizes, descriptive tags). Do NOT include shipping, delivery, "
    "returns, reviews, or any other business information. "
    "For 'style' pick one short lowercase style word that best describes the design."
)


REQUEST_DELAY_SECONDS = 1.0


def http_get(url: str, attempts: int = 4) -> requests.Response:
    """GET with a polite delay and backoff on rate limiting (429/5xx)."""
    time.sleep(REQUEST_DELAY_SECONDS)
    for attempt in range(1, attempts + 1):
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < attempts:
            wait = 5 * attempt
            log.info("  got %d for %s, retrying in %ds", resp.status_code, url, wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise AssertionError("unreachable")


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "other"


def collect_product_urls(site: dict, category: str, limit: int) -> list[str]:
    """Collect product page URLs from the category listing page, in page order."""
    collection_path = site["categories"][category]
    listing_url = urljoin(site["base_url"], collection_path)
    log.info("Collecting product links from %s", listing_url)
    soup = BeautifulSoup(http_get(listing_url).text, "lxml")

    # only links within this collection (e.g. /collections/rings/products/x),
    # otherwise nav/promo links to unrelated products slip in
    link_re = re.compile(re.escape(collection_path) + r"/products/[a-z0-9-]+$")

    urls: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        path = urlparse(a["href"]).path
        if not link_re.search(path):
            continue
        url = urljoin(site["base_url"], "/products/" + path.rsplit("/", 1)[1])
        if url not in seen:
            seen.add(url)
            urls.append(url)
        if len(urls) >= limit:
            break
    return urls


def largest_srcset_url(img) -> str | None:
    """Pick the largest candidate from srcset, falling back to src."""
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        best, best_w = None, -1
        for candidate in srcset.split(","):
            parts = candidate.strip().split()
            if not parts:
                continue
            width = 0
            if len(parts) > 1 and parts[1].endswith("w"):
                try:
                    width = int(parts[1][:-1])
                except ValueError:
                    width = 0
            if width > best_w:
                best, best_w = parts[0], width
        if best:
            return best
    return img.get("src") or img.get("data-src")


def extract_gallery_urls(site: dict, product_html: str) -> list[str]:
    """Return full-size image URLs from the product page's media gallery."""
    soup = BeautifulSoup(product_html, "lxml")
    urls: list[str] = []
    seen_files: set[str] = set()
    for img in soup.select(site["gallery_selector"]):
        url = largest_srcset_url(img)
        if not url:
            continue
        if url.startswith("//"):
            url = "https:" + url
        filename = Path(urlparse(url).path).name
        if filename in seen_files:  # same image at another size
            continue
        seen_files.add(filename)
        urls.append(url)

    if not urls:  # fallback: og:image
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            urls.append(og["content"])
    return urls


def jsonld_product_summary(product_html: str) -> dict:
    """Pull name/description/price out of the page's JSON-LD Product block."""
    soup = BeautifulSoup(product_html, "lxml")
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string or ""
        if '"Product"' not in text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        offers = data.get("offers") or []
        return {
            "name": data.get("name"),
            "description": data.get("description"),
            "price": offers[0].get("price") if offers else None,
            "currency": offers[0].get("priceCurrency") if offers else None,
        }
    return {}


def prune_product_html(site: dict, product_html: str, url: str) -> str:
    """Cut the page down to the main product block so the LLM only sees the
    product itself, plus the JSON-LD structured data for reliable pricing."""
    soup = BeautifulSoup(product_html, "lxml")
    parts: list[str] = []

    content = soup.select_one(site["content_selector"])
    if content:
        parts.append(str(content))

    summary = jsonld_product_summary(product_html)
    if summary:
        parts.append(f"<p>Structured product data: {json.dumps(summary)}</p>")

    return "\n".join(parts) if parts else url


def extract_product_info(source: str) -> dict:
    """Run the local-LLM scraper on (pruned) product page content."""
    graph = SmartScraperGraph(
        prompt=EXTRACT_PROMPT,
        source=source,
        config=GRAPH_CONFIG,
        schema=ProductInfo,
    )
    result = graph.run()
    if isinstance(result, dict) and "content" in result and isinstance(result["content"], dict):
        result = result["content"]
    return result


def download_photos(urls: list[str], dest: Path) -> list[str]:
    files: list[str] = []
    for i, url in enumerate(urls, start=1):
        ext = Path(urlparse(url).path).suffix.lower() or ".jpg"
        filename = f"{i:02d}{ext}"
        try:
            resp = http_get(url)
        except requests.RequestException as exc:
            log.warning("  photo %s failed: %s", url, exc)
            continue
        (dest / filename).write_bytes(resp.content)
        files.append(filename)
    return files


def scrape_product(site: dict, category: str, url: str) -> None:
    product_id = Path(urlparse(url).path).name
    log.info("Scraping %s", url)

    product_html = http_get(url).text
    gallery_urls = extract_gallery_urls(site, product_html)
    info = extract_product_info(prune_product_html(site, product_html, url))

    # backfill fields the LLM occasionally omits from structured data
    summary = jsonld_product_summary(product_html)
    for key in ("name", "description", "price", "currency"):
        if info.get(key) in (None, "", []) and summary.get(key) is not None:
            info[key] = summary[key]

    style = slugify(str(info.get("style") or "other"))
    info["style"] = style

    product_dir = DATA_DIR / category / style / product_id
    product_dir.mkdir(parents=True, exist_ok=True)

    photos = download_photos(gallery_urls, product_dir)

    record = {
        "id": product_id,
        "category": category,
        "source_url": url,
        **info,
        "photos": photos,
    }
    (product_dir / "product.json").write_text(json.dumps(record, indent=2, ensure_ascii=False))
    log.info("  saved %s (%d photos) -> %s", product_id, len(photos), product_dir)


def already_scraped(category: str, product_id: str) -> bool:
    category_dir = DATA_DIR / category
    if not category_dir.is_dir():
        return False
    return any((d / product_id / "product.json").is_file() for d in category_dir.iterdir() if d.is_dir())


def main() -> None:
    site = SITES["dlouise.com"]
    category = "ring"
    limit = 10

    urls = collect_product_urls(site, category, limit)
    log.info("Found %d product urls", len(urls))

    failures = 0
    for url in urls:
        product_id = Path(urlparse(url).path).name
        if already_scraped(category, product_id):
            log.info("Skipping %s (already scraped)", product_id)
            continue
        try:
            scrape_product(site, category, url)
        except Exception:
            failures += 1
            log.exception("Failed to scrape %s", url)

    if failures:
        log.warning("%d products failed", failures)
        sys.exit(1)


if __name__ == "__main__":
    main()
