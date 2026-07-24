import React from "react";
import {notFound} from "next/navigation";
import {Page, PageContent} from "@/components/Page";
import {Gallery} from "@/components/ui/gallery";
import {VariantSelectorCard} from "@/components/product/VariantSelectorCard";
import {ProductViewTracker} from "@/components/product/ProductViewTracker";
import {getProduct} from "@/lib/shopify/server";

export default async function ProductPage({params, searchParams}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {handle} = await params;
  const {finish, size} = await searchParams;
  const product = await getProduct(handle);
  if (!product) notFound();

  const images = product.images.edges.map(edge => edge.node);
  const asOne = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? null;

  return (
    <Page>
      <ProductViewTracker product={product}/>
      <PageContent className="flex md:flex-row flex-col items-start">
        <div className="w-full md:flex-5">
          <Gallery images={images}/>
        </div>
        <div className="md:flex-3 sticky top-8 md:top-12 lg:top-16 md:p-10 bg-surface-container w-full md:min-w-xs">
          <VariantSelectorCard fragment={product} initialFinish={asOne(finish)} initialSize={asOne(size)}/>
        </div>
      </PageContent>
    </Page>
  );
}
