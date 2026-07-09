import {createUnionKeySorter} from "@/lib/utils";

export const JEWELLERY_MATERIALS = ["gold", "vermeil", "silver"] as const;
export type Material = typeof JEWELLERY_MATERIALS[number];
export const jewelleryMaterialUtils = createUnionKeySorter(JEWELLERY_MATERIALS);

export type Category = "ring" | "necklace";

export const JEWELLERY_COLOURS = ["yellow", "rose", "white", "silver"] as const;
export type JewelleryColour = typeof JEWELLERY_COLOURS[number];
export const jewelleryColourUtils = createUnionKeySorter(JEWELLERY_COLOURS);

export type RingSize = "P" | "Q" | "R"
export type NecklaceSize = "12" | "15"
export type JewellerySize = NecklaceSize | RingSize;

type Carat = "9ct" | "10ct" | "12ct" | "14ct" | "18ct" | "20ct" | "22ct" | "24ct"
type SilverPurity = "sterling"
type GoldPurity = Carat
type VermeilPurity = Carat
export type JewelleryPurity = SilverPurity | GoldPurity | VermeilPurity


export type Jewellery = {
  material: Material;
  colour: JewelleryColour;
  purity: JewelleryPurity;
  size: string | null;
}
