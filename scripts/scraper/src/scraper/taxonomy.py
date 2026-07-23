"""Load `taxonomy.json` into a small typed model the classifier can query."""

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from .config import TAXONOMY_PATH


def fold(text: str) -> str:
    """Lowercase, strip diacritics, split joined words and collapse whitespace so
    that scraped copy and taxonomy synonyms compare equal regardless of case,
    accents (pavé==pave) or punctuation. Shopify tags are routinely written
    `18K-solid-white-gold`, so hyphens have to read as spaces."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[-_/\\&,+|]+", " ", text)
    return re.sub(r"\s+", " ", text.lower()).strip()


@dataclass
class Term:
    id: str
    label: str
    synonyms: list[str]
    definition: str
    facet: str
    category: str | None = None  # set for category-scoped facets (design)

    @property
    def phrases(self) -> list[str]:
        """All strings that, if found in product copy, identify this term."""
        return [self.label, *self.synonyms]


@dataclass
class Facet:
    id: str
    cardinality: str  # "one" | "many"
    scoped_by: str | None  # e.g. "category" for design
    terms: list[Term]


class Taxonomy:
    def __init__(self, facets: list[Facet]):
        self.facets = {f.id: f for f in facets}

    @classmethod
    def load(cls, path: Path = TAXONOMY_PATH) -> "Taxonomy":
        data = json.loads(path.read_text())
        facets = []
        for f in data["facets"]:
            terms = [
                Term(
                    id=t["id"],
                    label=t["label"],
                    synonyms=t.get("synonyms", []),
                    definition=t.get("definition", ""),
                    facet=f["id"],
                    category=t.get("category"),
                )
                for t in f["terms"]
            ]
            facets.append(
                Facet(
                    id=f["id"],
                    cardinality=f.get("cardinality", "one"),
                    scoped_by=f.get("scoped_by"),
                    terms=terms,
                )
            )
        return cls(facets)

    def facet(self, facet_id: str) -> Facet:
        return self.facets[facet_id]

    def term(self, facet_id: str, term_id: str) -> Term | None:
        return next((t for t in self.facets[facet_id].terms if t.id == term_id), None)

    def terms(self, facet_id: str, category: str | None = None) -> list[Term]:
        """Terms of a facet, narrowed to a category when the facet is scoped."""
        facet = self.facets[facet_id]
        if category and facet.scoped_by == "category":
            return [t for t in facet.terms if t.category == category]
        return facet.terms
