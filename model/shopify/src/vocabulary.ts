import vocabularyData from "../vocabulary.json";

// The model-owned controlled vocabulary — the metaobject *entries* (values). One
// map: metaobject type → entries, in seed order (material/colour before finish,
// which references them). Derived once from the scraper's taxonomy; the scraper's
// second pass aligns to this, not the other way round.

export interface VocabEntry {
  handle: string;
  fields: Record<string, string>;
}

export type Vocabulary = Record<string, VocabEntry[]>;

export const vocabulary: Vocabulary = vocabularyData.metaobjects as Vocabulary;
