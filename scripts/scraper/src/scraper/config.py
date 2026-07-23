"""Runtime constants, and the typed model of `sites.toml`.

The site roster, quotas and quality thresholds are configuration, not code, so
adding a brand or tightening a rule is a config edit. This module only loads and
validates; `quality.py` interprets the thresholds and `dispatch.py` the quotas.
"""

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path

# scripts/scraper/ (two levels up from src/scraper/config.py)
ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "sites.toml"
TAXONOMY_PATH = ROOT / "taxonomy.json"

# The curated finish vocabulary the seeder resolves against. We read it so a
# product whose metal cannot map onto any of these is dropped here, rather than
# being scraped, seeded, and then found unlinked in Shopify.
FINISH_VOCABULARY_PATH = ROOT.parents[1] / "model" / "shopify" / "vocabulary.json"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
)

# Politeness. Per-host spacing is what lets sites scrape in parallel, but Shopify
# stores (and their CDN) sit behind shared infrastructure that rate-limits by
# client IP across *all* of them, so there is a global floor as well — without it
# nine producers plus the image workers trip a store-wide 429 that takes minutes
# to clear. See web.fetch / dispatch.py.
REQUEST_DELAY_SECONDS = 2.5
GLOBAL_DELAY_SECONDS = 0.4
# Photos come from the image CDN, which is built to serve them and is not what
# rate-limits us. Throttling it like a storefront would make image downloads —
# by far the bulk of the requests — the slowest part of a run by an order of
# magnitude.
CDN_DELAY_SECONDS = 0.15
CDN_HOSTS = ("cdn.shopify.com", "cdn.shopifycdn.net")
RETRY_STATUS = (429, 500, 502, 503, 504)

# Worker threads pulling scrape jobs off the queue. Work is I/O-bound (HTTP), so
# more workers than sites still helps — they overlap photo downloads.
WORKERS = 6


@dataclass(frozen=True)
class Site:
    name: str
    base_url: str
    currency: str
    collections: dict[str, str]  # our category id -> the site's collection handle
    limit: int | None = None  # overrides defaults.limit for this site
    notes: str = ""


@dataclass(frozen=True)
class Quality:
    """Thresholds for `quality.assess`. See sites.toml for what each one means."""

    not_a_product: tuple[str, ...] = ()
    personalisation_options: tuple[str, ...] = ()
    size_options: tuple[str, ...] = ()
    metal_options: tuple[str, ...] = ()
    quantity_values: tuple[str, ...] = ()
    max_variants: int = 24
    require_design: bool = True
    require_material: bool = True
    require_image: bool = True
    require_price: bool = True
    require_available: bool = True


@dataclass(frozen=True)
class Config:
    output_dir: Path
    limit: int
    categories: tuple[str, ...]
    oversample: int
    max_pages: int
    sites: dict[str, Site]
    quality: Quality
    unsupported: tuple[tuple[str, str], ...] = ()  # (name, reason)

    @property
    def data_dir(self) -> Path:
        """Where the products/ tree is written."""
        return self.output_dir / "products"

    def select(self, names: list[str] | None) -> dict[str, Site]:
        """The requested sites, or all of them. Unknown names are an error —
        a typo should not silently scrape nothing."""
        if not names:
            return self.sites
        unknown = [n for n in names if n not in self.sites]
        if unknown:
            raise SystemExit(f"unknown site(s): {', '.join(unknown)}\n"
                             f"known: {', '.join(self.sites)}")
        return {n: self.sites[n] for n in names}

    def categories_for(self, site: Site, requested: list[str] | None) -> list[str]:
        """The categories to scrape from a site: what was asked for, narrowed to
        what the site actually has a collection for."""
        wanted = requested or list(self.categories)
        return [c for c in wanted if c in site.collections]


def load(path: Path = CONFIG_PATH, output_dir: str | None = None) -> Config:
    """Read sites.toml. `output_dir` (the --out flag) wins over SEED_DATA_DIR,
    which wins over the file."""
    raw = tomllib.loads(path.read_text())
    defaults = raw.get("defaults", {})

    sites: dict[str, Site] = {}
    for entry in raw.get("site", []):
        site = Site(
            name=entry["name"],
            base_url=entry["base_url"],
            currency=entry.get("currency", "GBP"),
            collections=dict(entry.get("collections", {})),
            limit=entry.get("limit"),
            notes=entry.get("notes", ""),
        )
        if not site.collections:
            raise SystemExit(f"{path.name}: site {site.name} has no collections")
        sites[site.name] = site
    if not sites:
        raise SystemExit(f"{path.name}: no sites configured")

    q = raw.get("quality", {})
    quality = Quality(
        not_a_product=tuple(q.get("not_a_product", [])),
        personalisation_options=tuple(q.get("personalisation_options", [])),
        size_options=tuple(q.get("size_options", [])),
        metal_options=tuple(q.get("metal_options", [])),
        quantity_values=tuple(q.get("quantity_values", [])),
        max_variants=q.get("max_variants", 24),
        require_design=q.get("require_design", True),
        require_material=q.get("require_material", True),
        require_image=q.get("require_image", True),
        require_price=q.get("require_price", True),
        require_available=q.get("require_available", True),
    )

    out = output_dir or os.environ.get("SEED_DATA_DIR") or raw.get("output_dir")
    if not out:
        raise SystemExit(f"{path.name}: no output_dir (set it, --out, or SEED_DATA_DIR)")

    return Config(
        output_dir=Path(out).expanduser(),
        limit=defaults.get("limit", 12),
        categories=tuple(defaults.get("categories", [])),
        oversample=defaults.get("oversample", 15),
        max_pages=defaults.get("max_pages", 4),
        sites=sites,
        quality=quality,
        unsupported=tuple((u["name"], u.get("reason", "")) for u in raw.get("unsupported", [])),
    )
