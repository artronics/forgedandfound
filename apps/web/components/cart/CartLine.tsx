import {FragmentType, useFragment} from "@/graphql/generated";
import {CartLine_CartLineFragmentDoc, Variant_ProductVariantFragmentDoc} from "@/graphql/generated/graphql";
import {useCartLineActions} from "@/lib/cart/useCartLineActions";
import React from "react";
import {Badge} from "@/components/ui/badge";
import {AspectRatio} from "@/components/ui/aspect-ratio";
import Image from "next/image";
import {getThumbImage} from "@/lib/utils";
import {IconButton} from "@/components/ui/icon";
import {Spinner} from "@/components/ui/spinner";
import {Skeleton} from "@/components/ui/skeleton";
import {Price, Text} from "@/components/typography";
import {useVariantPrice} from "@/lib/product/useVariantPrice";
import {toVariant} from "@/lib/product/variant";

type CartItemProps = {
  lineFragment: FragmentType<typeof CartLine_CartLineFragmentDoc>;
}

export function CartLine({lineFragment}: CartItemProps) {
  const line = useFragment(CartLine_CartLineFragmentDoc, lineFragment);
  const raw = useFragment(Variant_ProductVariantFragmentDoc, line?.merchandise);
  const variant = raw ? toVariant(raw) : null;

  const productTitle = raw?.product.title;
  const finishLabel = variant?.finishLabel;
  const image = raw?.image;
  const size = variant?.sizeLabel;
  const {price, compareAtPrice} = useVariantPrice(variant ?? []);

  const {quantity, isMaxStocked, loading, inc, dec, remove} = useCartLineActions(line);

  return (
    <div className="flex flex-col w-full">
      <div className="flex w-full gap-2">
        <div className="aspect-square size-24">
          <AspectRatio ratio={1}>
            <Image
              fill
              src={image?.thumbnail}
              alt={image?.altText ?? `Image of ${productTitle} in ${finishLabel} finish`}
              placeholder="blur"
              blurDataURL={getThumbImage(image?.thumbhash)}>
            </Image>
          </AspectRatio>
        </div>
        <div className="flex flex-col flex-1">
          <div className="relative">
            <IconButton
              icon="x"
              variant="ghost"
              className="absolute top-1 right-0 hover:bg-transparent"
              size="icon-sm"
              onClick={remove}
            />
          </div>
          <Text variant="title" className="text-xl">{productTitle}</Text>
          <div className="space-x-2">
            <span className="uppercase opacity-75">{size}</span>
            <span className="font-medium uppercase">{finishLabel}</span>
          </div>
          <div className="mt-auto items-end flex">
            <Price size="sm" price={price} compareAtPrice={compareAtPrice}/>
            <div className="ml-auto flex items-center">
              {isMaxStocked && (
                <Badge variant="ghost" className="text-xs capitalize opacity-75">max qty reached</Badge>)}
              <IconButton icon="minus" variant="ghost" aria-label="decrement cart item" size="icon"
                          onClick={dec} disabled={loading}/>

              <Badge variant="ghost" className="mx-2">{quantity}
                {loading && <Spinner data-icon="inline-end"/>}
              </Badge>

              <IconButton icon="plus" variant="ghost" aria-label="increment cart item" size="icon"
                          onClick={inc} disabled={loading || isMaxStocked}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartLineSkeleton() {
  return (
    <div className="flex">
      <div className="aspect-square ">
        <Skeleton className="h-10 w-10 rounded-md"/>
      </div>

      <div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40 rounded-md"/>
          <Skeleton className="h-3 w-28 rounded-md"/>
        </div>
        <Skeleton className="h-10 w-28 rounded-full"/>
      </div>
    </div>
  );
}
