import React from "react";
import Link from "next/link";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType} from "@/graphql/generated";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import {Label} from "@/components/ui/label";
import {Price} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {FinishPicker} from "@/components/product/VariantPicker";
import {Frame} from "@/components/ui/media";
import {QuickAddSheet} from "@/components/cart/QuickAddSeet";
import {Badge} from "@/components/ui/badge";
import {AddWishListButton} from "@/components/wishlist/AddWishListButton";

// The reduced listing surface: image, title, finish swatches, price. Size is
// chosen in the quick-add sheet, which inherits the selected finish.

type ProductItemCardProps = {
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null
}

export function ProductItemCard({fragment}: ProductItemCardProps) {
  const {
    product,
    finishes,
    selected,
    select,
    displayVariant,
  } = useVariantSelector({fragment: fragment ?? null});

  const {price, compareAtPrice} = useVariantPrice(displayVariant ?? []);
  const image = displayVariant?.image ?? null;
  const productUrl = `/products/${product.handle}`;

  const label = "new arrival";

  return (
    <Card>
      <Frame className="group-frame" image={image} href={productUrl}>
        <div
          className={cn(
            "absolute bottom-4 right-4 backdrop-blur-sm",
            "opacity-0 group-hover/frame:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/frame:translate-y-0",
          )}
        >
          <QuickAddSheet fragment={fragment} selectedFinish={selected.finish}/>
        </div>
        <div className={cn("absolute top-4 right-4")}>
          <AddWishListButton productId={product.id}/>
        </div>
        <Badge className={cn("top-4 left-4", label ? "absolute" : "hidden")}>
          {label}
        </Badge>
      </Frame>
      <CardHeader className="mb-4">
        <Link href={productUrl}>
          <div className="flex flex-col">
            <CardTitle>{product.title}</CardTitle>
            <Label className="tracking-wide text-sm">{displayVariant?.finishLabel}</Label>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FinishPicker
          size="sm"
          choices={finishes}
          selected={selected.finish}
          onSelect={select.finish}
        />
        <Price className="ml-auto" price={price} compareAtPrice={compareAtPrice}/>
      </CardContent>
    </Card>
  );
}
