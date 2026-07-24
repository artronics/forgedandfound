"use client";

import React from "react";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType} from "@/graphql/generated";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {Price, Text} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {FinishPicker, SizePicker} from "@/components/product/VariantPicker";
import {AddToCartButton} from "@/components/product/AddToCartButton";

// The PDP selector surface: full pickers with headings, price, add to cart.
// User selections are mirrored into the URL (?finish=…&size=…) in place —
// shareable without navigation. The auto-selected default never writes.

type VariantSelectorCardProps = {
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null;
  initialFinish?: string | null;
  initialSize?: string | null;
}

export function VariantSelectorCard({fragment, initialFinish, initialSize}: VariantSelectorCardProps) {
  const {
    product,
    finishes,
    sizes,
    selected,
    select,
    selectedVariant,
    displayVariant,
  } = useVariantSelector({fragment: fragment ?? null, initialFinish, initialSize});
  const {price, compareAtPrice} = useVariantPrice(displayVariant ?? []);
  const outOfStock = selectedVariant?.availability === "OUT_OF_STOCK";

  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!touched.current) return;
    const params = new URLSearchParams();
    if (selected.finish) params.set("finish", selected.finish);
    if (selected.size) params.set("size", selected.size);
    const search = params.size ? `?${params}` : "";
    window.history.replaceState(null, "", window.location.pathname + search);
  }, [selected.finish, selected.size]);
  const selectTouched = {
    finish: (key: string) => {
      touched.current = true;
      select.finish(key);
    },
    size: (key: string) => {
      touched.current = true;
      select.size(key);
    },
  };

  return (
    <Card>
      <CardHeader className="mb-4">
        <div className="flex flex-col">
          <div className="flex items-start justify-between">
            <CardTitle>{product.title}</CardTitle>
          </div>
          <Label className="tracking-wide text-sm">{displayVariant?.finishLabel}</Label>
          <Price className="text-xl ml-auto py-2" price={price} compareAtPrice={compareAtPrice}/>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FinishPicker
          title="Select Finish"
          choices={finishes}
          selected={selected.finish}
          onSelect={selectTouched.finish}
        />
        <SizePicker
          title="Select Size"
          choices={sizes}
          selected={selected.size}
          onSelect={selectTouched.size}
        />
        {/* Actions */}
        <div>
          {outOfStock && (
            <Text variant="label" className="text-sm opacity-75">
              This option is out of stock.
            </Text>
          )}
          <AddToCartButton
            className="my-8"
            productId={product?.id}
            variantId={selectedVariant && !outOfStock ? selectedVariant.id : null}
          />
        </div>
      </CardContent>
    </Card>
  );
}
