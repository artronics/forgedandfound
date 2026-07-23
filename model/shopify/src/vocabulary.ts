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

// Cast through `unknown`: entries within a type are deliberately heterogeneous
// (a ring size fills uk/us/eu, a chain length fills length_cm/length_inches), so
// TS infers a union of object literals whose absent keys are `undefined` rather
// than a plain Record<string, string>. Every value present at runtime is a string.
export const vocabulary: Vocabulary = vocabularyData.metaobjects as unknown as Vocabulary;
