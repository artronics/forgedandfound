"use client";

import * as React from "react";
import {Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious} from "@/components/ui/carousel";

// Placeholder product data – replace with real data / props
const PLACEHOLDER_PRODUCTS = Array.from({length: 6}, (_, i) => ({
  id: i,
  name: `Product ${i + 1}`,
  price: "$120.00",
}));

export function Recommendation() {
  return (
    <div className="px-12">
      <Carousel
        opts={{align: "start"}}
        className="w-full"
      >
        <CarouselContent>
          {PLACEHOLDER_PRODUCTS.map((product) => (
            <CarouselItem key={product.id} className="basis-1/2 md:basis-1/3 lg:basis-1/4">
              <div className="space-y-2">
                <div className="aspect-3/4 w-full bg-muted"/>
                <div className="space-y-1">
                  <p className="font-sans text-sm text-foreground">{product.name}</p>
                  <p className="font-sans text-xs text-secondary">{product.price}</p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious/>
        <CarouselNext/>
      </Carousel>
    </div>
  );
}
