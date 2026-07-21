"""Map free-text product copy onto canonical taxonomy ids by synonym matching.

Deterministic and dependency-free: for each facet we look for any of a term's
phrases (label + synonyms) as whole words in the (case/diacritic-folded) copy.
`one`-cardinality facets keep the single best match; `many` keep all matches.
Nothing matched -> the facet is omitted and the source is logged, per the
CATEGORISATION.md contract (omit rather than guess).
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


class Classifier:
    def __init__(self, taxonomy: Taxonomy):
        self.tax = taxonomy
        self._patterns: dict[str, re.Pattern] = {}

    def _pattern(self, phrase: str) -> re.Pattern:
        """Whole-word matcher for a folded phrase, compiled once and cached."""
        folded = fold(phrase)
        pat = self._patterns.get(folded)
        if pat is None:
            pat = self._patterns[folded] = re.compile(rf"\b{re.escape(folded)}\b")
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

    def classify_value(self, facet_id: str, value: str, category: str | None = None) -> str | None:
        """Map one option value (e.g. a "Gold" colour swatch) to a canonical id
        of the given facet, or None. Used to normalise variant axes."""
        return self._best(self.tax.terms(facet_id, category), fold(value))

    def classify(self, copy: str, category: str, spec_copy: str = "") -> dict:
        """Return {category, design, styles, material, ...} of canonical ids.

        `copy` is the product's own marketing text (name + description); optional
        `spec_copy` is fuller detail text used only for attribute facets. Unmatched
        facets are left out (omit rather than guess, per CATEGORISATION.md).
        """
        subjective = fold(copy)
        attributes = fold(f"{copy}\n{spec_copy}") if spec_copy else subjective
        result: dict = {"category": category}

        for facet_id, out_key in _OUTPUT_KEY.items():
            facet = self.tax.facet(facet_id)
            terms = self.tax.terms(facet_id, category)
            text = subjective if facet_id in _SUBJECTIVE else attributes
            if facet.cardinality == "many":
                ids = [t.id for t in terms if self._matches(t, text)]
                if ids:
                    result[out_key] = ids
            else:
                best = self._best(terms, text)
                if best:
                    result[out_key] = best

        if "design" not in result:
            log.info("  no design matched for a %s (copy: %.80s)", category, copy)
        return result
