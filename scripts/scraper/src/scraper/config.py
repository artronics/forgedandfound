"""Runtime constants and per-site scraping config."""

from pathlib import Path

# scripts/scraper/ (two levels up from src/scraper/config.py)
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "products"
TAXONOMY_PATH = ROOT / "taxonomy.json"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
)

# Politeness: minimum gap between requests to the *same host*, and back off on
# rate limiting. Different hosts are not throttled against each other, so sites
# scrape in parallel (see web.fetch / dispatch.py).
REQUEST_DELAY_SECONDS = 1.0
RETRY_STATUS = (429, 500, 502, 503, 504)

# Worker threads pulling scrape jobs off the queue. Work is I/O-bound (HTTP), so
# more workers than sites still helps — they overlap photo downloads.
WORKERS = 6

# Sites are Shopify storefronts: we read the collection `products.json` (full
# product objects incl. variants/options/images) rather than scraping HTML.
# `currency` is config because that endpoint reports prices without a currency
# code; both brands are UK/GBP.
SITES = {
    "dlouise.com": {
        "base_url": "https://dlouise.com",
        "currency": "GBP",
        "collections": {  # our canonical category id -> Shopify collection handle
            "ring": "rings",
            "necklace": "necklaces",
            "bracelet": "bracelets",
            "earring": "earrings",
        },
    },
    "astridandmiyu.com": {
        "base_url": "https://www.astridandmiyu.com",
        "currency": "GBP",
        "collections": {
            "ring": "rings",
            "necklace": "necklaces",
            "bracelet": "bracelets",
            "earring": "earrings",
        },
    },
}
