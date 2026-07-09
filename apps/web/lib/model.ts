import {norm, removeDuplicateWords} from "@/lib/utils";

/** Raw Shopify availability — derived only from the two fields Shopify exposes. */
export type Availability = "AVAILABLE" | "BACKORDER" | "OUT_OF_STOCK";

type MaterialCategory = "GOLD" | "VERMEIL" | "SILVER"
type ColourCategory = "GOLD" | "ROSE" | "WHITE" | "SILVER"
export type Material =
  | "GOLD_9CT"
  | "GOLD_14CT"
  | "GOLD_18CT"
  | "GOLD_22CT"
  | "SILVER_STERLING"
  | "VERMEIL_9CT"
  | "VERMEIL_14CT"
  | "VERMEIL_18CT"
  | "VERMEIL_22CT";

type VariantOptions = {
  selectedOptions: { name: string, value: string }[];
}

type ProductVariant = {
  id: string;
  availableForSale: boolean;
  currentlyNotInStock: boolean;
} & VariantOptions;

type ProductOption = {
  kind: "COLOUR"
  colour: ColourCategory | null
} | {
  kind: "MATERIAL"
  material: Material | null
} | {
  kind: "SIZE"
  size: string | null
}

/**
 * Return the value of a specific option on a variant by matching on the
 * option name.  Returns undefined when the variant has no such option.
 */
const getOptionValue = (variant?: VariantOptions, predicate: (name: string) => boolean = () => true): string | undefined =>
  variant?.selectedOptions.find((o) => predicate(o.name))?.value;

const isOptionColour = (name: string) => norm(name) === "color" || norm(name) === "colour";
const isOptionMaterial = (name: string) => norm(name) === "jewelry material" || norm(name) === "jewellery material";
const isOptionSize = (name: string) => norm(name).includes("size");

const getColourOption = (variant?: VariantOptions) => getOptionValue(variant, isOptionColour);
const getMaterialOption = (variant?: VariantOptions) => getOptionValue(variant, isOptionMaterial);
const getSizeOption = (variant?: VariantOptions) => getOptionValue(variant, isOptionSize);

const parseMaterial = (p: string): [MaterialCategory, Material | null] | null => {
  const s = norm(p);
  if (s.includes("silver")) return ["SILVER", "SILVER_STERLING"];

  if (s.includes("vermeil")) {
    if (s.includes("22")) return ["VERMEIL", "VERMEIL_22CT"];
    if (s.includes("18")) return ["VERMEIL", "VERMEIL_18CT"];
    if (s.includes("14")) return ["VERMEIL", "VERMEIL_14CT"];
    if (s.includes("9")) return ["VERMEIL", "VERMEIL_9CT"];
    return ["VERMEIL", null];
  }

  if (s.includes("gold")) {
    if (s.includes("22")) return ["GOLD", "GOLD_22CT"];
    if (s.includes("18")) return ["GOLD", "GOLD_18CT"];
    if (s.includes("14")) return ["GOLD", "GOLD_14CT"];
    if (s.includes("9")) return ["GOLD", "GOLD_9CT"];
    return ["GOLD", null];
  }

  return null;
};
const caratMap: { [key in Material]: "9ct" | "14ct" | "18ct" | "22ct" | "Sterling Silver" } = {
  GOLD_9CT: "9ct",
  GOLD_14CT: "14ct",
  GOLD_18CT: "18ct",
  GOLD_22CT: "22ct",
  VERMEIL_9CT: "9ct",
  VERMEIL_14CT: "14ct",
  VERMEIL_18CT: "18ct",
  VERMEIL_22CT: "22ct",
  SILVER_STERLING: "Sterling Silver",
} as const;

const getVariantLabel = ({colour, material}: { colour: string | null, material: string | null }) => {
  return removeDuplicateWords(
    [
      parseCarat(material ?? ""),
      colourLabel(colour ?? ""),
      materialLabel(material ?? ""),
    ]
      .filter(Boolean)
      .join(" "),
  );
};

const getAvailability = (v: ProductVariant): Availability => {
  if (!v.availableForSale) return "OUT_OF_STOCK";
  if (v.currentlyNotInStock) return "BACKORDER";
  return "AVAILABLE";
};

export const VariantModel = {
  getAvailability,
  getVariantLabel,
  getColourOption,
  getMaterialOption,
  getSizeOption,
  isOptionColour,
} as const;

const parseCarat = (str: string) => {
  const s = norm(str);
  if (s.includes("silver")) return "sterling silver";
  const caratRegex = /(\d+\s*(?:ct|k))/i;
  const match = s.match(caratRegex);
  return match?.[1].toLowerCase() ?? null;
};

const materialLabel = (str: string) => {
  const s = norm(str);
  if (s.includes("silver")) return "Sterling Silver";
  if (s.includes("vermeil")) return "Gold Vermeil";
  if (s.includes("gold")) return "Gold";
  return null;
};

const colourLabel = (str: string) => {
  const s = norm(str);
  if (s.includes("rose")) return "Rose Gold";
  if (s.includes("white")) return "White Gold";
  if (s.includes("gold") || s.includes("yellow")) return "Gold";
  if (s.includes("silver")) return "Silver";
  return null;
};
