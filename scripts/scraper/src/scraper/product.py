"""Turn a raw Shopify product object into two records.

`meta.json` is the product exactly as the source site presents it — title,
vendor, its own product_type, *all* its tags, raw options/variants/images. No
conversions; it's the faithful record of the actual product.

`product.json` is that product expressed in *our* data model
(model/shopify/MODEL.md): canonical category plus each classified facet as a
metaobject **handle** (design, styles, material, metal_colour, purity, gemstones,
stone_shapes, setting, chain_type). The seeder resolves those handles to Shopify
metaobject GIDs and composes the per-variant `finish`. It carries everything
needed to recreate the product and its variants in our own Shopify.
"""

from pathlib import Path
from urllib.parse import urljoin, urlparse

from .classify import Classifier
from .config import Quality
from .quality import axis_for, real_options
from .web import html_to_text


def _filename(src: str) -> str:
    return Path(urlparse(src).path).name


def classify_product(raw: dict, category: str, classifier: Classifier) -> dict:
    """Classify from the product's own copy. The title carries the most authority,
    then the fuller marketing copy; tags/option values add signal for attribute
    facets only (see classify.Classifier)."""
    title = raw.get("title") or ""
    marketing = "\n".join(filter(None, [title, raw.get("product_type"),
                                        html_to_text(raw.get("body_html", ""))]))
    option_values = [v for o in raw.get("options", []) for v in o.get("values", [])]
    tags = raw.get("tags") if isinstance(raw.get("tags"), list) else []
    spec = " ".join(tags + option_values)
    return classifier.classify(title, marketing, category, spec_copy=spec)


# The facets a metal option value can name. An option value is rarely just one:
# "18ct Yellow Gold Vermeil" names all three at once.
_METAL_FACETS = ("material", "metal_colour", "purity")


def _metal_axis(values: list[str], category: str, classifier: Classifier) -> tuple[str, dict[str, dict]]:
    """Read a metal option's values, and say which facet it *varies*.

    Each value is classified across material, colour and purity, because an
    option value routinely names more than one ("9ct Three Colour Gold" is a
    purity and a colour). The axis label is the facet whose value actually
    differs between the options — that is what the shopper is choosing — with
    colour breaking a tie, since it is the more common swatch.
    """
    canonical = {
        value: {
            facet: cid
            for facet in _METAL_FACETS
            if (cid := classifier.classify_value(facet, value, category))
        }
        for value in values
    }
    distinct = {
        facet: {f.get(facet) for f in canonical.values() if f.get(facet)}
        for facet in _METAL_FACETS
    }
    varying = [f for f in ("material", "purity") if len(distinct[f]) > 1]
    axis = varying[0] if varying and len(distinct["metal_colour"]) <= 1 else "metal_colour"
    return axis, canonical


def build_options(raw: dict, category: str, classifier: Classifier, quality: Quality) -> list[dict]:
    options = []
    for opt in real_options(raw):
        name, values = opt.get("name", ""), opt.get("values", [])
        axis = axis_for(name, quality)
        entry = {"name": name, "position": opt.get("position"), "axis": axis, "values": values}
        if axis == "metal":
            entry["axis"], entry["canonical"] = _metal_axis(values, category, classifier)
        options.append(entry)
    return options


def _build_variants(raw: dict, src_to_file: dict[str, str]) -> list[dict]:
    variants = []
    for v in raw.get("variants", []):
        options = [v.get(f"option{i}") for i in (1, 2, 3) if v.get(f"option{i}") is not None]
        img = v.get("featured_image") or {}
        img_src = img.get("src") if isinstance(img, dict) else None
        variants.append({
            "id": v.get("id"),
            "title": v.get("title"),
            "options": options,
            "price": float(v["price"]) if v.get("price") not in (None, "") else None,
            "sku": v.get("sku"),
            "barcode": v.get("barcode"),
            "weight": v.get("weight"),
            "available": v.get("available"),
            "image": src_to_file.get(_filename(img_src)) if img_src else None,
        })
    return variants


def build_meta(site_name: str, base_url: str, currency: str, raw: dict, images: list[dict]) -> dict:
    """The product as scraped — raw, no synonym/canonical conversion."""
    src_to_file = {_filename(img["src"]): img["file"] for img in images}
    variants = _build_variants(raw, src_to_file)
    prices = [v["price"] for v in variants if v["price"] is not None]
    return {
        "id": raw.get("handle"),
        "site": site_name,
        "source_url": urljoin(base_url, f"/products/{raw.get('handle')}"),
        "title": raw.get("title"),
        "vendor": raw.get("vendor"),
        "product_type": raw.get("product_type"),  # the site's own type, as-is
        "description": html_to_text(raw.get("body_html", "")),
        "tags": raw.get("tags", []),  # every tag we saw, unfiltered
        "currency": currency,
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "options": [
            {"name": o.get("name"), "position": o.get("position"), "values": o.get("values", [])}
            for o in raw.get("options", [])
        ],
        "variants": variants,
        "images": images,
    }


def build_product(site_name: str, category: str, raw: dict, classification: dict,
                  classifier: Classifier, images: list[dict], options: list[dict]) -> dict:
    """The product in our data model — every classified facet is a metaobject
    handle the seeder resolves to a GID. Single-valued facets are a str (or
    null); multi-valued facets are a list. Unmatched facets are null/empty.

    `options` comes from `build_options`, which the quality gate needs before we
    commit to a product, so it is passed in rather than rebuilt.
    """
    category_term = classifier.tax.term("category", category)
    src_to_file = {_filename(img["src"]): img["file"] for img in images}
    return {
        "id": raw.get("handle"),
        "site": site_name,
        "category": category,
        "product_type": category_term.label if category_term else category,
        # Single-valued facets (metaobject handle | null).
        "design": classification.get("design"),
        "material": classification.get("material"),
        "metal_colour": classification.get("metal_colour"),
        "purity": classification.get("purity"),
        "setting": classification.get("setting"),
        "chain_type": classification.get("chain_type"),
        # Multi-valued facets (list of metaobject handles).
        "styles": classification.get("styles", []),
        "gemstones": classification.get("gemstones", []),
        "stone_shapes": classification.get("stone_shapes", []),
        "options": options,
        "variants": _build_variants(raw, src_to_file),
        "images": [img["file"] for img in images],
    }
