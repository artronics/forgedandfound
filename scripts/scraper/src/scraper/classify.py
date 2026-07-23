"""Map free-text product copy onto canonical taxonomy ids by synonym matching.

Deterministic and dependency-free: for each facet we look for any of a term's
phrases (label + synonyms) as whole words in the (case/diacritic/punctuation
folded) copy. `one`-cardinality facets keep the single best match; `many` keep
all matches. Nothing matched -> the facet is omitted and the source is logged,
per the CATEGORISATION.md contract (omit rather than guess).

Single-value facets read the copy in **authority order**: the title first, then
the fuller marketing copy, then (attribute facets only) tags and option values.
The first tier that answers wins. Titles are curated and specific — "Molten Olive
Stacking Ring 18ct Gold Plated" says exactly what the piece is — whereas tags are
merchandising surface where a plated ring is also filed under "solid gold" so it
shows up in that edit. Reading them as equals is what previously classified a
vermeil ring as sterling silver.
"""

import logging
import re

from .taxonomy import Taxonomy, Term, fold

log = logging.getLogger("scraper.classify")

# Facets classified from copy. `category` is known up front, so it's excluded.
# Maps facet id -> output key ("many" facets get a plural, list-valued key).
_OUTPUT_KEY = {
    "design": "design",
    "material": "material",
    "metal_colour": "metal_colour",
    "purity": "purity",
    "setting": "setting",
    "chain_type": "chain_type",
    "style": "styles",
    "gemstone": "gemstones",
    "stone_shape": "stone_shapes",
}

# Subjective facets are read from the product's own marketing copy only; attribute
# facets also get the fuller spec text. This keeps a brand's shared boilerplate
# (e.g. a "waterproof" banner -> style:everyday) from tagging every product.
_SUBJECTIVE = {"design", "style"}

# Purity only means something in the context of a material, and copy routinely
# names more than one metal: a gold vermeil ring is described over a sterling
# silver core, so "925" gets picked up for a piece whose purity is 18ct. A purity
# that its material cannot carry is dropped rather than reported.
_PURITY_FOR_MATERIAL = {
    "solid-gold": {"18ct", "14ct", "9ct"},
    "gold-vermeil": {"18ct", "14ct"},
    "gold-plated": {"18ct", "14ct", "9ct"},
    "sterling-silver": {"925"},
    "platinum": set(),
    "stainless-steel": set(),
    "mixed-metal": set(),
}


class Classifier:
    def __init__(self, taxonomy: Taxonomy):
        self.tax = taxonomy
        self._patterns: dict[str, re.Pattern] = {}

    def _pattern(self, phrase: str) -> re.Pattern:
        """Whole-word matcher for a folded phrase, compiled once and cached.
        Lookarounds rather than \\b so phrases that begin or end in punctuation
        (`92.5%`) still anchor."""
        folded = fold(phrase)
        pat = self._patterns.get(folded)
        if pat is None:
            pat = self._patterns[folded] = re.compile(rf"(?<!\w){re.escape(folded)}(?!\w)")
        return pat

    def _matches(self, term: Term, text: str) -> list[str]:
        return [p for p in term.phrases if self._pattern(p).search(text)]

    def _best(self, terms: list[Term], text: str) -> str | None:
        """Highest-scoring term for a single-value facet, or None.

        Score prefers the most specific hit: longest matched phrase first (so
        "gold vermeil" beats "gold"), then the most distinct phrases matched.
        """
        scored = []
        for term in terms:
            hits = self._matches(term, text)
            if hits:
                scored.append((max(len(h) for h in hits), len(hits), term.id))
        if not scored:
            return None
        return max(scored)[2]

    def _best_by_authority(self, terms: list[Term], tiers: list[str]) -> str | None:
        """The first tier that identifies a term wins, most authoritative first."""
        for text in tiers:
            best = self._best(terms, text)
            if best:
                return best
        return None

    def classify_value(self, facet_id: str, value: str, category: str | None = None) -> str | None:
        """Map one option value (e.g. a "Gold" colour swatch) to a canonical id
        of the given facet, or None. Used to normalise variant axes."""
        return self._best(self.tax.terms(facet_id, category), fold(value))

    def classify(self, title: str, marketing: str, category: str, spec_copy: str = "") -> dict:
        """Return {category, design, styles, material, ...} of canonical ids.

        `title` is the product name, `marketing` its fuller own copy (name, type,
        description) and `spec_copy` the tags and option values. Unmatched facets
        are left out (omit rather than guess, per CATEGORISATION.md).
        """
        folded_title = fold(title)
        folded_marketing = fold(marketing)
        folded_all = fold(f"{marketing}\n{spec_copy}") if spec_copy else folded_marketing
        result: dict = {"category": category}

        for facet_id, out_key in _OUTPUT_KEY.items():
            facet = self.tax.facet(facet_id)
            terms = self.tax.terms(facet_id, category)
            widest = folded_marketing if facet_id in _SUBJECTIVE else folded_all
            if facet.cardinality == "many":
                # Every match counts — a piece really can carry three gemstones.
                ids = [t.id for t in terms if self._matches(t, widest)]
                if ids:
                    result[out_key] = ids
            else:
                best = self._best_by_authority(terms, [folded_title, folded_marketing, widest])
                if best:
                    result[out_key] = best

        material, purity = result.get("material"), result.get("purity")
        if purity and purity not in _PURITY_FOR_MATERIAL.get(material, {purity}):
            del result["purity"]

        if "design" not in result:
            log.debug("  no design matched for a %s (%.60s)", category, title)
        return result
