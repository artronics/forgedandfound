"""Scrape real jewellery product data to seed a Shopify dev shop with test data.

Deterministic, no LLM. For each Shopify site we page the collection
`products.json` API (full product objects), keep only the products that pass the
quality gate, and write everything needed to recreate them and their variants:

    <output_dir>/products/<category>/<design>/<id>/meta.json     # as the site presents it
    <output_dir>/products/<category>/<design>/<id>/product.json  # in our data model
    <output_dir>/products/<category>/<design>/<id>/NN.jpg        # images

The site roster, quotas and quality thresholds live in `sites.toml`, so the flag
surface stays small: pick sites and categories, set a limit, point somewhere
else. Sites are scraped concurrently (see dispatch.py).

Accuracy of any one product is not the goal — this is throwaway data — but a
*bad* product costs real time downstream, so we drop far more than we keep.
"""

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path

from . import config as config_module
from . import dispatch, product, quality, web
from .classify import Classifier
from .config import Config, Site, WORKERS
from .taxonomy import Taxonomy

log = logging.getLogger("scraper")


@dataclass
class Candidate:
    """One product, classified and judged. Built once in the producer thread and
    carried to the worker, so nothing is classified twice."""

    handle: str
    raw: dict
    classification: dict
    options: list[dict]
    verdict: quality.Verdict = field(default=quality.KEEP)

    @property
    def design(self) -> str:
        return self.classification.get("design", "unclassified")


class Scraper:
    """Holds everything a job needs: the taxonomy, the quality gate, the output
    directory. Threads share one instance; it is read-only after construction
    apart from the filesystem writes each job makes into its own directory."""

    def __init__(self, config: Config, dry_run: bool = False, refresh: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.refresh = refresh
        self.classifier = Classifier(Taxonomy.load())
        self.finishes = quality.load_finishes()

    # --- decide -------------------------------------------------------------

    def seen(self, category: str, handle: str) -> bool:
        """Already scraped in an earlier run? The design folder isn't known
        without reclassifying, so we look for the handle under any of them.

        `--refresh` reports everything as unseen so a run rewrites what's on
        disk — what a product classifies as changes when the taxonomy does, and
        a stale record is worse than no record.
        """
        if self.refresh:
            return False
        category_dir = self.config.data_dir / category
        if not category_dir.is_dir():
            return False
        return any((d / handle / "product.json").is_file()
                   for d in category_dir.iterdir() if d.is_dir())

    def prepare(self, site: Site, category: str, raw: dict) -> Candidate:
        classification = product.classify_product(raw, category, self.classifier)
        options = product.build_options(raw, category, self.classifier, self.config.quality)
        return Candidate(
            handle=raw.get("handle") or "",
            raw=raw,
            classification=classification,
            options=options,
            verdict=quality.assess(raw, classification, options,
                                   self.config.quality, self.finishes),
        )

    # --- do -----------------------------------------------------------------

    def save(self, site: Site, category: str, candidate: Candidate) -> None:
        if self.dry_run:
            log.info("  would save %s/%s [%s/%s, %d variants]", site.name, candidate.handle,
                     category, candidate.design, len(candidate.raw.get("variants", [])))
            return

        dest = self.config.data_dir / category / candidate.design / candidate.handle
        images = web.download_images(candidate.raw.get("images", []), dest)
        meta = product.build_meta(site.name, site.base_url, site.currency, candidate.raw, images)
        prod = product.build_product(site.name, category, candidate.raw,
                                     candidate.classification, self.classifier, images,
                                     candidate.options)
        _write(dest / "meta.json", meta)
        _write(dest / "product.json", prod)
        log.info("  saved %s/%s [%s/%s, %d variants, %d images]", site.name, candidate.handle,
                 category, candidate.design, len(prod["variants"]), len(images))


def _write(path: Path, record: dict) -> None:
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False))


def _report(outcomes: dict[str, dispatch.Outcome], dry_run: bool) -> int:
    """Per-site tally, with the rejection reasons that shaped it. Returns the
    total kept."""
    total_kept = total_failed = 0
    print(f"\n{'site':22} {'kept':>5} {'had':>5} {'saw':>5}   why the rest went", file=sys.stderr)
    print("-" * 100, file=sys.stderr)
    for name, o in outcomes.items():
        total_kept += o.kept
        total_failed += o.failed
        reasons = ", ".join(f"{reason} {count}" for reason, count in o.rejected.most_common())
        print(f"{name:22} {o.kept:5} {o.skipped:5} {o.considered:5}   {reasons or '-'}", file=sys.stderr)
        if o.failed:
            print(f"{'':22} {o.failed:5} failed", file=sys.stderr)
    print("\nkept = written now, had = already on disk, saw = candidates examined",
          file=sys.stderr)
    verb = "would keep" if dry_run else "kept"
    print(f"\n{verb} {total_kept} products"
          + (f", {total_failed} failed" if total_failed else ""), file=sys.stderr)
    return total_kept


def _list_sites(config: Config) -> None:
    for name, site in config.sites.items():
        cats = ", ".join(config.categories_for(site, None))
        print(f"{name:22} {cats}")
        if site.notes:
            print(f"{'':22} {site.notes}")
    if config.unsupported:
        print("\nnot scrapable (no Shopify products.json):")
        for name, reason in config.unsupported:
            print(f"  {name:22} {reason}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="scraper",
        description="Scrape jewellery seed data. Sites, quotas and quality rules "
                    "live in sites.toml; these flags narrow or override it.",
    )
    parser.add_argument("-s", "--site", action="append", metavar="NAME",
                        help="only this site (repeatable); default is all of them")
    parser.add_argument("-c", "--category", action="append", metavar="ID",
                        help="only this category (repeatable): ring, necklace, earring, bracelet")
    parser.add_argument("-n", "--limit", type=int, metavar="N",
                        help="products to keep PER SITE, split evenly across its categories")
    parser.add_argument("-o", "--out", metavar="DIR",
                        help="output directory (default: output_dir in sites.toml)")
    parser.add_argument("--dry-run", action="store_true",
                        help="fetch, classify and filter, but write nothing")
    parser.add_argument("--refresh", action="store_true",
                        help="re-scrape products already on disk instead of skipping them")
    parser.add_argument("--list-sites", action="store_true", help="show the roster and exit")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="log every rejection with its reason")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", stream=sys.stderr)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    config = config_module.load(output_dir=args.out)
    if args.list_sites:
        _list_sites(config)
        return

    unknown = [c for c in (args.category or []) if c not in config.categories]
    if unknown:
        raise SystemExit(f"unknown categor(ies): {', '.join(unknown)}\n"
                         f"known: {', '.join(config.categories)}")

    sites = config.select(args.site)
    scraper = Scraper(config, dry_run=args.dry_run, refresh=args.refresh)
    log.info("%s %d site(s) into %s", "planning" if args.dry_run else "scraping",
             len(sites), config.data_dir)

    outcomes = dispatch.run(sites, config, args.category, args.limit,
                            scraper.prepare, scraper.seen, scraper.save, WORKERS)

    kept = _report(outcomes, args.dry_run)
    if any(o.failed for o in outcomes.values()):
        sys.exit(1)
    if not kept and not any(o.skipped for o in outcomes.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
