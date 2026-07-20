"use client";

import React from "react";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType} from "@/graphql/generated";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {Price} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {SwatchGroup} from "@/components/ui/swatch";
import {OptionGroup, OptionItem} from "@/components/ui/option";
import {VariantModel} from "@/lib/model";
import {useCandidateVariant} from "@/lib/product/useCandidateVariant";
import {FinishSwatch} from "@/components/product/FinishSwatch";
import {AddToCartButton} from "@/components/product/AddToCartButton";

type VariantSelectorCardProps = {
  selectedColour?: string,
  selectedMaterial?: string,
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null
}

export function VariantSelectorCard({fragment}: VariantSelectorCardProps) {
  const {
    product,
    colours,
    materials,
    sizes,
    filter,
    setFilter,
    filteredVariants,
    selectedVariant,
  } = useVariantSelector({fragment: fragment ?? null});
  const candidateVariant = useCandidateVariant(selectedVariant ?? filteredVariants[0]);
  const variantLabel = VariantModel.getVariantLabel(candidateVariant);
  const {price, compareAtPrice} = useVariantPrice(filteredVariants);

  return (
    <Card>
      <CardHeader className="mb-4">
        <div className="flex flex-col">
          <div className="flex items-start justify-between">
            <CardTitle>{product.title}</CardTitle>
          </div>
          <Label className="tracking-wide text-sm">{variantLabel}</Label>
          <Price className="text-xl ml-auto py-2" price={price} compareAtPrice={compareAtPrice}/>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Colour */}
        {colours.length > 1 && (
          <div>
            <Label variant="field" className="pb-1">
              Select Colour
            </Label>
            <SwatchGroup>
              {colours.map((colour) => (
                <FinishSwatch
                  key={colour}
                  colour={colour}
                  selected={filter.colour === colour}
                  onSelect={() => setFilter.colour(colour)}
                />
              ))}
            </SwatchGroup>
          </div>
        )}
        {/* Material */}
        {materials.length > 1 && (
          <div>
            <Label variant="field">Select Material</Label>
            <OptionGroup className="pt-1">
              {materials.map(material => (
                <OptionItem
                  key={material}
                  onClick={() => setFilter.material(material)}
                  selected={filter.material === material}>
                  {material}
                </OptionItem>
              ))}
            </OptionGroup>
          </div>
        )}
        {/* Size */}
        {sizes.length !== 0
          ? (<div>
            <Label variant="field">Select Size</Label>
            <OptionGroup className="pt-1">
              {sizes.map(size => (
                <OptionItem
                  key={size}
                  onClick={() => setFilter.size(size)}
                  selected={filter.size === size}>
                  {size}
                </OptionItem>
              ))}
            </OptionGroup>
          </div>)
          : (<div>
              <Label variant="field">Size</Label>
              <OptionGroup className="pt-1">
                {[candidateVariant.size].map(size => (
                  <OptionItem
                    key={size}
                    onClick={() => setFilter.size(size)}
                    disabled={true}
                    selected={true}>
                    {size}
                  </OptionItem>
                ))}
              </OptionGroup>
            </div>

          )}
        {/* Actions */}
        <div>
          <AddToCartButton
            className="my-8"
            productId={product?.id}
            variantId={selectedVariant?.id ?? null}
          />
        </div>
      </CardContent>
    </Card>
  );
}