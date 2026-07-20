import React from "react";
import {notFound} from "next/navigation";
import {Gallery} from "@/components/ui/gallery";
import {getProduct} from "@/lib/shopify/server";

export default async function TestPage() {
  const product = await getProduct("test-necklace-realistic-2");
  if (!product) notFound();

  const images = product.images.edges.map(edge => edge.node);
  return (
    <div className="w-full flex-1">
      <Gallery images={images}/>
    </div>
  );
}
