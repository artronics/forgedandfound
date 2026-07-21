"""Scrape real jewellery product data to seed a Shopify dev shop with test data.

Deterministic, no LLM. For each Shopify site we read the collection
`products.json` API (full product objects) and, per product, write everything
needed to recreate it and its variants in our own Shopify:

    data/products/<category>/<design>/<id>/product.json   # facts + variants + classification
    data/products/<category>/<design>/<id>/NN.jpg         # images

Sites are scraped concurrently through a shared job queue (see dispatch.py).
Scope: two sites (dlouise.com, astridandmiyu.com), category ring, 10 each.
Accuracy is not a goal — this is throwaway seed data.
"""

import json
import logging
import sys

from . import dispatch, product, web
from .classify import Classifier
from .config import DATA_DIR, SITES, WORKERS
from .taxonomy import Taxonomy

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scraper")


def _write(path, record: dict) -> None:
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False))


def already_scraped(category: str, product_id: str) -> bool:
    category_dir = DATA_DIR / category
    if not category_dir.is_dir():
        return False
    return any((d / product_id / "product.json").is_file() for d in category_dir.iterdir() if d.is_dir())


def make_handler(classifier: Classifier) -> dispatch.Handler:
    def scrape_product(site_name: str, site: dict, category: str, raw: dict) -> None:
        handle = raw.get("handle")
        if already_scraped(category, handle):
            log.info("Skipping %s/%s (already scraped)", site_name, handle)
            return

        classification = product.classify_product(raw, category, classifier)
        design = classification.get("design", "unclassified")
        dest = DATA_DIR / category / design / handle

        images = web.download_images(raw.get("images", []), dest)
        meta = product.build_meta(site_name, site["base_url"], site["currency"], raw, images)
        prod = product.build_product(site_name, category, raw, classification, classifier, images)
        _write(dest / "meta.json", meta)
        _write(dest / "product.json", prod)
        log.info("  saved %s/%s [design=%s, %d variants, %d images]",
                 site_name, handle, design, len(prod["variants"]), len(images))

    return scrape_product


def main() -> None:
    category = "ring"
    limit = 10

    classifier = Classifier(Taxonomy.load())
    failures = dispatch.run(SITES, category, limit, make_handler(classifier), WORKERS)

    if failures:
        log.warning("%d products failed", failures)
        sys.exit(1)


if __name__ == "__main__":
    main()
