import type {Spec, SpecField, SpecMetafield, SpecMetaobject} from "./types.ts";

// The desired state — the single source of truth the reconciler converges the
// store to. Derived directly from MODEL.md. Metaobjects are ordered so that a
// definition appears before any definition that references it (material/colour
// before finish), which is also the order the reconciler creates them in.

const label: SpecField = {key: "label", name: "Label", type: "single_line_text_field", required: true};
const description: SpecField = {key: "description", name: "Description", type: "multi_line_text_field"};

const PURITY_CHOICES = ["18ct", "14ct", "9ct", "925"];
const CATEGORY_CHOICES = ["ring", "necklace", "earring", "bracelet"];

const metaobjects: SpecMetaobject[] = [
  {type: "jewellery_material", name: "Material", fields: [label, description]},
  {
    type: "jewellery_colour",
    name: "Colour",
    fields: [
      label,
      {key: "swatch", name: "Swatch", type: "color", required: true},
      {key: "image", name: "Image", type: "file_reference"},
    ],
  },
  {
    // Composite variant axis: collapses material × purity × colour into one
    // value so they never become separate (Cartesian-exploding) axes.
    type: "jewellery_finish",
    name: "Finish",
    fields: [
      label,
      {key: "material", name: "Material", type: "metaobject_reference", refType: "jewellery_material", required: true},
      {key: "purity", name: "Purity", type: "single_line_text_field", choices: PURITY_CHOICES},
      {key: "colour", name: "Colour", type: "metaobject_reference", refType: "jewellery_colour"},
      {key: "swatch", name: "Swatch", type: "color"},
      {key: "sort_order", name: "Sort order", type: "number_integer"},
    ],
  },
  {
    type: "jewellery_design",
    name: "Design",
    fields: [
      label,
      // Category-scoping lives in the data (MODEL.md §7), not in Shopify.
      {key: "category", name: "Category", type: "single_line_text_field", required: true, choices: CATEGORY_CHOICES},
      description,
    ],
  },
  {type: "jewellery_style", name: "Style", fields: [label, description]},
  {type: "jewellery_gemstone", name: "Gemstone", fields: [label, description]},
  {type: "jewellery_stone_shape", name: "Stone Shape", fields: [label]},
  {type: "jewellery_setting", name: "Setting", fields: [label, description]},
  {type: "jewellery_chain_type", name: "Chain Type", fields: [label]},
];

/** Product metafield backed by a metaobject reference (single or list). */
function ref(key: string, name: string, refType: string, list = false): SpecMetafield {
  return {
    ownerType: "PRODUCT",
    key,
    name,
    type: list ? "list.metaobject_reference" : "metaobject_reference",
    refType,
    pin: true,
  };
}

const metafields: SpecMetafield[] = [
  ref("design", "Design", "jewellery_design"),
  ref("style", "Style", "jewellery_style", true),
  ref("gemstone", "Gemstone", "jewellery_gemstone", true),
  ref("stone_shape", "Stone Shape", "jewellery_stone_shape", true),
  ref("setting", "Setting", "jewellery_setting"),
  ref("chain_type", "Chain Type", "jewellery_chain_type"),
  // Denormalised filter projections of the product's finishes (MODEL.md §8).
  ref("material", "Material", "jewellery_material", true),
  ref("metal_colour", "Metal Colour", "jewellery_colour", true),
  {ownerType: "PRODUCT", key: "purity", name: "Purity", type: "list.single_line_text_field", pin: true},
  // Finish↔variant substrate (MODEL.md §5.2): each variant references its composite
  // finish. The storefront reads material/purity/colour off this metaobject; the visible
  // "Finish" option can also be natively linked to this same metafield.
  {ownerType: "PRODUCTVARIANT", key: "finish", name: "Finish", type: "metaobject_reference", refType: "jewellery_finish", pin: true},
];

export const spec: Spec = {metaobjects, metafields};
