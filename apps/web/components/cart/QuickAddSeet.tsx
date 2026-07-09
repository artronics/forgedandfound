"use client";

import React from "react";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import Image from "next/image";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {getThumbImage} from "@/lib/utils";
import {FragmentType} from "@/graphql/generated";
import {Price, Text} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {SwatchGroup} from "@/components/ui/swatch";
import {OptionGroup, OptionItem} from "@/components/ui/option";
import {Button} from "@/components/ui/button";
import {useCandidateVariant} from "@/lib/product/useCandidateVariant";
import {VariantModel} from "@/lib/model";
import {Label} from "@/components/ui/label";
import {AddToCartButton} from "@/components/product/AddToCartButton";
import {FinishSwatch} from "@/components/product/FinishSwatch";

type QuickAddSheetProps = {
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null;
  selectedColour: string | null;
  selectedMaterial: string | null;
}

export function QuickAddSheet({fragment, selectedColour}: QuickAddSheetProps) {
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
  const {price, compareAtPrice} = useVariantPrice(filteredVariants);
  const isSelected = !!selectedVariant;
  const image = selectedVariant?.image || filteredVariants[0]?.image;

  // const finishLabel = filteredVariants
  //   .find(v => v.jewellery?.finishId === filter.finish)
  //   ?.jewellery?.finishLabel;

  const candidateVariant = useCandidateVariant(selectedVariant ?? filteredVariants[0]);
  const variantLabel = VariantModel.getVariantLabel(candidateVariant);

  const onOpenChange = (isOpen: boolean) => {
    if (isOpen && selectedColour) {
      setFilter.colour(selectedColour);
    }
    setOpen(isOpen);
  };
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet aria-describedby="quick-add" open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-transparent py-3 px-4">
          Quick Add
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            Quick Add
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col p-4 gap-8">
          <div className="flex w-full gap-4 pb-2 border-b border-border/40">
            <div className="relative aspect-square size-22">
              <Image
                fill
                src={image?.url}
                alt={image?.altText ?? "cart product image"}
                placeholder="blur"
                blurDataURL={getThumbImage(image?.thumbhash)}>
              </Image>
            </div>
            <div className="flex flex-col flex-1">
              <Text variant="title" className="text-2xl w-fit text-ellipsis">{product.title}</Text>
              <div className="flex gap-2 text-sm">
                {isSelected && (<><span className="uppercase opacity-75">{candidateVariant.size}</span><span
                  className="font-bold">·</span></>)}
                <span className="capitalize">{variantLabel}</span>
              </div>
              <Price price={price} compareAtPrice={compareAtPrice} className="mt-auto"/>
            </div>
          </div>

          {colours.length > 1 && (
            <div>
              <Text variant="label" className="pb-1 text-2xs">Select Colour</Text>
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

          <AddToCartButton
            variantId={isSelected ? selectedVariant?.id ?? null : null}
            productId={product?.id}
            onClick={() => setOpen(false)}/>
        </div>
      </SheetContent>
    </Sheet>
  );
}
