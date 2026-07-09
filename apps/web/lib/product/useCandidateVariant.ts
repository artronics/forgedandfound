import {norm} from "@/lib/utils";
import {VariantModel} from "@/lib/model";
import {useQuery} from "@apollo/client/react";
import {GetProductMetafieldsDocument} from "@/graphql/generated/graphql";

const {getColourOption, getMaterialOption, getSizeOption} = VariantModel;

type VariantOptions = {
  selectedOptions: { name: string, value: string }[];
}

type Variant = {
  product?: {
    id: string
  }
} & VariantOptions;

const getLabel = (fields: { key: string, value: string | null }[]) =>
  fields.find(f => f.key.toLowerCase() === "label")?.value ?? null;

const isColour = (str: string) => norm(str) === "shopify--color-pattern";
const isMaterial = (str: string) => norm(str) === "shopify--jewelry-material";
const isSize = (str: string) => norm(str).includes("necklace_size");

export function useCandidateVariant(variant?: Variant) {
  const variantColour = getColourOption(variant);
  const variantMaterial = getMaterialOption(variant);
  const variantSize = getSizeOption(variant);

  const shouldFetch = !variantColour || !variantMaterial || !variantSize;

  const {data, loading, error} = useQuery(GetProductMetafieldsDocument, {
    skip: !shouldFetch || !variant?.product?.id,
    variables: {
      productId: variant?.product?.id,
      identifiers: [
        {namespace: "shopify", key: "color-pattern"},
        {namespace: "shopify", key: "jewelry-material"},
        {namespace: "custom", key: "necklace_size"},
      ],
    },
  });

  const metafields = (loading || error) ? [] : data?.product?.metafields ?? [];

  const nodes =
    metafields
      ?.flatMap(mf => mf?.references?.nodes ?? [])
      .filter(
        (n): n is Extract<typeof n, { __typename?: "Metaobject" }> =>
          n?.__typename === "Metaobject",
      ) ?? [];

  const colour =
    variantColour ??
    getLabel(nodes.find(n => isColour(n.type))?.fields ?? []);

  const material =
    variantMaterial ??
    getLabel(nodes.find(n => isMaterial(n.type))?.fields ?? []);

  const size =
    variantSize ??
    getLabel(nodes.find(n => isSize(n.type))?.fields ?? []);

  return {
    colour,
    material,
    size,
  };
}

