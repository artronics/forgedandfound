"""Decide whether a scraped product is good enough to keep.

Seed data is throwaway, but *bad* seed data costs real time: a product that
carries no material ends up in Shopify with no finish on any variant, and one
whose copy contradicts itself ends up with the wrong one. Both happened in the
first pass. So the scraper is deliberately picky — it would rather return seven
good rings than twelve padded ones, and a category that cannot fill its quota
simply doesn't.

Every rejection carries a named reason, tallied per site by the CLI, so it is
always visible *why* a site yielded what it did.
"""

import functools
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from .config import FINISH_VOCABULARY_PATH, Quality
from .taxonomy import fold

log = logging.getLogger("scraper.quality")


@functools.lru_cache(maxsize=256)
def _phrase(phrase: str) -> re.Pattern:
    """Whole-word matcher, so excluding "set" drops a "Ring Set" but keeps a
    "Sunset Ring"."""
    return re.compile(rf"(?<!\w){re.escape(fold(phrase))}(?!\w)")

# A product with no real variants uses Shopify's placeholder option.
PLACEHOLDER_OPTION = "Default Title"


@dataclass(frozen=True)
class Finish:
    """One entry of the curated `jewellery_finish` vocabulary."""

    handle: str
    material: str | None
    colour: str | None
    purity: str | None


def load_finishes(path: Path = FINISH_VOCABULARY_PATH) -> list[Finish]:
    entries = json.loads(path.read_text())["metaobjects"]["jewellery_finish"]
    return [
        Finish(
            handle=e["handle"],
            material=e["fields"].get("material"),
            colour=e["fields"].get("colour"),
            purity=e["fields"].get("purity"),
        )
        for e in entries
    ]


def _agrees(a: str | None, b: str | None) -> bool:
    """An unset facet on either side is a wildcard — the same rule the seeder's
    matcher uses, so what survives here is what will resolve there."""
    return not a or not b or a == b


def resolves_to_finish(material: str | None, colour: str | None, purity: str | None,
                       finishes: list[Finish]) -> bool:
    return any(
        _agrees(material, f.material) and _agrees(colour, f.colour) and _agrees(purity, f.purity)
        for f in finishes
    )


# The axes product.json records. All three describe the metal and collapse into
# one Finish option downstream (MODEL.md §5); the label says which facet the
# shopper is actually choosing between.
METAL_AXES = ("material", "metal_colour", "purity")


def axis_for(option_name: str, quality: Quality) -> str | None:
    """Coarsely: which model axis a Shopify option belongs on — "size", "metal"
    or None. `product._build_options` refines "metal" into which facet it varies
    by looking at the values.

    Keywords match as whole words anywhere in the name, so "Choose Ring Size" and
    "Chain length" both land on size while "Gemstone" is not read as a metal
    "tone". None means the product carries a dimension our model has no room for.
    """
    if any(_phrase(k).search(fold(option_name)) for k in quality.size_options):
        return "size"
    if any(_phrase(k).search(fold(option_name)) for k in quality.metal_options):
        return "metal"
    return None


def is_personalisation(option_name: str, quality: Quality) -> bool:
    """Initials, letters, zodiac signs: axes that multiply a product into dozens
    of near-identical variants saying nothing about the model."""
    return any(_phrase(word).search(fold(option_name)) for word in quality.personalisation_options)


def is_quantity(values: list[str], quality: Quality) -> bool:
    """An axis choosing how many you get, not which one. Sites label these "Size"
    (Pair / Single), so the values are the only tell."""
    if not values:
        return False
    return all(fold(v) in quality.quantity_values for v in values)


def real_options(raw: dict) -> list[dict]:
    """The product's options minus Shopify's single-variant placeholder."""
    return [
        o for o in raw.get("options", [])
        if not (o.get("name") == "Title" and o.get("values") == [PLACEHOLDER_OPTION])
    ]


@dataclass(frozen=True)
class Verdict:
    reason: str = ""  # empty == keep
    detail: str = ""

    def __bool__(self) -> bool:
        return not self.reason


KEEP = Verdict()


def assess(raw: dict, classification: dict, options: list[dict],
           quality: Quality, finishes: list[Finish]) -> Verdict:
    """Keep or reject one product. `options` are the normalised axes from
    `product._build_options` (so the metal axis has its `canonical` map)."""
    title = fold(raw.get("title") or "")
    product_type = fold(raw.get("product_type") or "")

    # 1. Not a piece of jewellery, or not one piece of it.
    for phrase in quality.not_a_product:
        pattern = _phrase(phrase)
        if pattern.search(title) or pattern.search(product_type):
            return Verdict("not_a_product", phrase)

    # 2. Nothing to show or sell.
    variants = raw.get("variants") or []
    if quality.require_image and not raw.get("images"):
        return Verdict("no_images")
    if quality.require_price and not any(v.get("price") not in (None, "") for v in variants):
        return Verdict("no_price")
    if quality.require_available and not any(v.get("available") for v in variants):
        return Verdict("out_of_stock")

    # 3. Variant structure our model can carry.
    if len(variants) > quality.max_variants:
        return Verdict("too_many_variants", str(len(variants)))
    for option in options:
        name = option["name"]
        if is_personalisation(name, quality):
            return Verdict("personalisation", name)
        if option["axis"] is None:
            return Verdict("unmapped_axis", name)
        if is_quantity(option.get("values", []), quality):
            return Verdict("quantity_axis", name)

    # 4. Classified well enough to be worth seeding.
    if quality.require_design and not classification.get("design"):
        return Verdict("no_design")

    material = classification.get("material")
    colour = classification.get("metal_colour")
    purity = classification.get("purity")
    metal_axis = next((o for o in options if o["axis"] in METAL_AXES), None)
    # What each option value names, e.g. {"9ct Three Colour Gold": {"purity": "9ct", ...}}.
    axis_facets = [f for f in (metal_axis or {}).get("canonical", {}).values() if f]

    # A product whose metal varies gets its finish per variant, so it doesn't
    # need a product-level material; anything else does, or the seeder has
    # nothing to resolve.
    if quality.require_material and not material and not axis_facets:
        return Verdict("no_metal")

    # 5. The metal has to map onto a finish we actually stock. Each option value
    # is laid over the product's own classification — the axis says what varies,
    # the product supplies the rest — and one resolvable combination is enough,
    # since the seeder handles the others (including its curated aliases). Where
    # the metal is constant it must resolve on its own. This is what catches copy
    # that contradicts itself, e.g. a ring titled "in Gold" whose tags say
    # sterling silver.
    combos = [
        (f.get("material") or material, f.get("metal_colour") or colour, f.get("purity") or purity)
        for f in axis_facets
    ] or [(material, colour, purity)]
    if not any(resolves_to_finish(m, c, p, finishes) for m, c, p in combos):
        return Verdict("metal_contradiction", f"{material or '?'}/{colour or '?'}/{purity or '?'}")

    return KEEP
