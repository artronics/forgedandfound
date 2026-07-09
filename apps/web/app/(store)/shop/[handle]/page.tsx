"use client";

import {Page, PageContent} from "@/components/Page";
import React from "react";
import {useProduct} from "@/lib/product/useProduct";
import {ProductGallery_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {useFragment} from "@/graphql/generated";
import {Gallery} from "@/components/ui/gallery";
import {useSegment} from "@/lib/route/useSegment";
import {VariantSelectorCard} from "@/components/product/VariantSelectorCard";

export default function ProductPage() {
  const handle = useSegment("handle");
  const {data, loading, error} = useProduct({handle});
  const gallery = useFragment(ProductGallery_ProductFragmentDoc, data?.product);
  const images = gallery?.images.edges.map(edge => edge?.node) ?? [];
  return (
    <Page>
      <PageContent className="flex md:flex-row flex-col items-start">
        <div className="w-full md:flex-5">
          <Gallery images={images}/>
        </div>
        <div className="md:flex-3 sticky top-8 md:top-12 lg:top-16 md:p-10 bg-surface-container w-full md:min-w-xs">
          <VariantSelectorCard fragment={data?.product}/>
        </div>
      </PageContent>
    </Page>
  );
}
