"use client";

import React from "react";
import {useProduct} from "@/lib/product/useProduct";
import {useFragment} from "@/graphql/generated";
import {ProductGallery_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {Gallery} from "@/components/ui/gallery";

export default function TestPage() {
  const {data, loading, error} = useProduct({handle: "test-necklace-realistic-2"});
  const gallery = useFragment(ProductGallery_ProductFragmentDoc, data?.product);
  const images = gallery?.images.edges.map(edge => edge?.node) ?? [];
  return (
    <div className="w-full flex-1">
      <Gallery images={images}/>
    </div>
  );
}
