"use client";

import React from "react";
import Image from "next/image";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType} from "@/graphql/generated";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {getThumbImage} from "@/lib/utils";
import {Price, Text} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {Button} from "@/components/ui/button";
import {FinishPicker, SizePicker} from "@/components/product/VariantPicker";
import {AddToCartButton} from "@/components/product/AddToCartButton";

// The quick-add surface: the full pickers in a sheet, opened from a product
// card, inheriting the finish the card had selected.

type QuickAddSheetProps = {
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null;
  /** The finish selected on the card that opened this sheet. */
  selectedFinish?: string | null;
}

export function QuickAddSheet({fragment, selectedFinish}: QuickAddSheetProps) {
  const {
    product,
    finishes,
    sizes,
    selected,
    select,
    selectedVariant,
    displayVariant,
  } = useVariantSelector({fragment: fragment ?? null, initialFinish: selectedFinish});
  const {price, compareAtPrice} = useVariantPrice(displayVariant ?? []);
  const outOfStock = selectedVariant?.availability === "OUT_OF_STOCK";
  const image = displayVariant?.image;

  const [open, setOpen] = React.useState(false);
  const onOpenChange = (isOpen: boolean) => {
    if (isOpen && selectedFinish) {
      select.finish(selectedFinish);
    }
    setOpen(isOpen);
  };

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
              {image && (
                <Image
                  fill
                  src={image.url}
                  alt={image.altText ?? "cart product image"}
                  placeholder="blur"
                  blurDataURL={getThumbImage(image.thumbhash)}>
                </Image>
              )}
            </div>
            <div className="flex flex-col flex-1">
              <Text variant="title" className="text-2xl w-fit text-ellipsis">{product.title}</Text>
              <div className="flex gap-2 text-sm">
                {selectedVariant?.sizeLabel && (
                  <><span className="uppercase opacity-75">{selectedVariant.sizeLabel}</span><span
                    className="font-bold">·</span></>
                )}
                <span className="capitalize">{displayVariant?.finishLabel}</span>
              </div>
              <Price price={price} compareAtPrice={compareAtPrice} className="mt-auto"/>
            </div>
          </div>

          <FinishPicker
            title="Select Finish"
            choices={finishes}
            selected={selected.finish}
            onSelect={select.finish}
          />
          <SizePicker
            title="Select Size"
            choices={sizes}
            selected={selected.size}
            onSelect={select.size}
          />
          {outOfStock && (
            <Text variant="label" className="text-sm opacity-75">
              This option is out of stock.
            </Text>
          )}

          <AddToCartButton
            variantId={selectedVariant && !outOfStock ? selectedVariant.id : null}
            productId={product?.id}
            onClick={() => setOpen(false)}/>
        </div>
      </SheetContent>
    </Sheet>
  );
}
