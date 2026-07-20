import React from "react";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType} from "@/graphql/generated";
import {useVariantSelector} from "@/lib/product/useVariantSelector";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import {Label} from "@/components/ui/label";
import {Price} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {SwatchGroup} from "@/components/ui/swatch";
import {FinishSwatch} from "@/components/product/FinishSwatch";
import {Frame} from "@/components/ui/media";
import {QuickAddSheet} from "@/components/cart/QuickAddSeet";
import {Badge} from "@/components/ui/badge";
import {VariantModel} from "@/lib/model";
import Link from "next/link";
import {useCandidateVariant} from "@/lib/product/useCandidateVariant";
import {AddWishListButton} from "@/components/wishlist/AddWishListButton";

type VariantSelectorCardProps = {
  fragment?: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null
}

export function ProductItemCard({fragment}: VariantSelectorCardProps) {
  const {
    product,
    colours,
    filter,
    setFilter,
    filteredVariants,
    selectedVariant,
  } = useVariantSelector({fragment: fragment ?? null});
  const candidateVariant = useCandidateVariant(selectedVariant ?? filteredVariants[0]);
  const variantLabel = VariantModel.getVariantLabel(candidateVariant);

  const {price, compareAtPrice} = useVariantPrice(filteredVariants);
  const image = filteredVariants[0]?.image;
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
          <QuickAddSheet fragment={fragment} selectedColour={filter.colour} selectedMaterial={filter.material}/>
        </div>
        <div className={cn("absolute top-4 right-4")}>
          <AddWishListButton productId={product.id}/>
        </div>
        <Badge className={cn("top-4 left-4", label ? "absolute" : "hidden")}>
          {label}
        </Badge>
      </Frame>
      <CardHeader className="mb-4">
        <Link href={`/products/${product.handle}`}>
          <div className="flex flex-col">
            <CardTitle>{product.title}</CardTitle>
            <Label className="tracking-wide text-sm">{variantLabel}</Label>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Colour */}
        {colours.length > 1 && (
          <div>
            <SwatchGroup size="sm">
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
        <Price className="ml-auto" price={price} compareAtPrice={compareAtPrice}/>
      </CardContent>
    </Card>
  );
}