"""Turn a raw Shopify product object into two records.

`meta.json` is the product exactly as the source site presents it — title,
vendor, its own product_type, *all* its tags, raw options/variants/images. No
conversions; it's the faithful record of the actual product.

`product.json` is that product expressed in *our* data model (CATEGORISATION.md):
canonical category, `design:`/`style:` tags, dimension metafields, and the
variant axes normalised to taxonomy ids. It carries everything needed to
recreate the product and its variants in our own Shopify.
"""

from pathlib import Path
from urllib.parse import urljoin, urlparse

from .classify import Classifier
from .web import html_to_text

# classification keys that are dimensions -> Shopify metafields (custom.*),
# as opposed to design/style which become tags. See CATEGORISATION.md §2.
_METAFIELD_KEYS = ("material", "metal_colour", "purity", "setting", "chain_type",
                   "gemstones", "stone_shapes")


def _filename(src: str) -> str:
    return Path(urlparse(src).path).name

# Shopify option name (lowered) -> taxonomy axis. Size/length are variant-only
# (CATEGORISATION.md §6.8); colour and material are dimensions we can normalise.
_AXIS_KEYWORDS = {
    "size": "size",
    "length": "size",
    "colour": "metal_colour",
    "color": "metal_colour",
    "metal": "metal_colour",
    "finish": "metal_colour",
    "tone": "metal_colour",
    "plating": "metal_colour",
    "material": "material",
}

# A product with no real variants uses Shopify's placeholder option.
_PLACEHOLDER_OPTION = "Default Title"


def _axis_for(option_name: str) -> str | None:
    lowered = option_name.lower()
    for keyword, axis in _AXIS_KEYWORDS.items():
        if keyword in lowered:
            return axis
    return None


def classify_product(raw: dict, category: str, classifier: Classifier) -> dict:
    """Classify from the product's own copy. product_type + title + description
    drive subjective facets; tags/options add signal for attribute facets."""
    marketing = "\n".join(filter(None, [raw.get("title"), raw.get("product_type"),
                                         html_to_text(raw.get("body_html", ""))]))
    option_values = [v for o in raw.get("options", []) for v in o.get("values", [])]
    spec = " ".join(raw.get("tags", []) + option_values) if isinstance(raw.get("tags"), list) else " ".join(option_values)
    return classifier.classify(marketing, category, spec_copy=spec)


def _build_options(raw: dict, category: str, classifier: Classifier) -> list[dict]:
    options = []
    for opt in raw.get("options", []):
        name, values = opt.get("name", ""), opt.get("values", [])
        if name == "Title" and values == [_PLACEHOLDER_OPTION]:
            continue  # single-variant product: no real axis
        axis = _axis_for(name)
        entry = {"name": name, "position": opt.get("position"), "axis": axis, "values": values}
        # Normalise colour/material swatch labels to canonical ids where possible.
        if axis in ("metal_colour", "material"):
            entry["canonical"] = {
                v: cid for v in values if (cid := classifier.classify_value(axis, v, category))
            }
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
                  classifier: Classifier, images: list[dict]) -> dict:
    """The product in our data model — only taxonomy-recognised values survive."""
    category_term = classifier.tax.term("category", category)
    # design + style are the only facets modelled as tags (namespaced); the rest
    # are metafields. Unmatched facets simply don't appear.
    tags = []
    if classification.get("design"):
        tags.append(f"design:{classification['design']}")
    tags += [f"style:{s}" for s in classification.get("styles", [])]
    metafields = {k: classification[k] for k in _METAFIELD_KEYS if k in classification}

    src_to_file = {_filename(img["src"]): img["file"] for img in images}
    return {
        "id": raw.get("handle"),
        "site": site_name,
        "category": category,
        "product_type": category_term.label if category_term else category,
        "tags": tags,
        "metafields": metafields,
        "options": _build_options(raw, category, classifier),
        "variants": _build_variants(raw, src_to_file),
        "images": [img["file"] for img in images],
    }
