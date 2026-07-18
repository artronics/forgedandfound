"use client";

import Link from "next/link";
import {useHero} from "@/lib/shop/useHero";
import Image from "next/image";
import {GetShopQuery} from "@/graphql/generated/graphql";

type HeroReference = NonNullable<NonNullable<GetShopQuery["shop"]["hero"]>["reference"]>;
type MediaImageReference = Extract<HeroReference, { __typename: "MediaImage" }>;
export function HeroSection() {
  const {data, loading, error} = useHero();
  const hero = data?.shop?.hero?.reference as MediaImageReference | undefined;
  return (
    <section className="relative h-[90vh] min-h-150 flex items-center overflow-hidden px-6 lg:px-10">
      {/* Background image placeholder */}
      <div className="absolute inset-0 z-0 bg-muted">
        {/* Replace with <Image fill> */}
        {hero?.image?.url && <Image src={hero?.image?.url} fill alt={hero?.image?.altText ?? ""}/>}
      </div>

      {/* Subtle overlay */}
      <div className="absolute inset-0 z-10 bg-foreground/10"/>

      {/* Content */}
      <div className="relative z-20 w-full max-w-7xl mx-auto">
        <div className="max-w-2xl space-y-8">
          <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-foreground/60">
            Autumn / Winter &apos;24 Collection
          </p>
          <h1
            className="font-serif italic text-7xl md:text-8xl font-light leading-[0.9] tracking-tight text-foreground">
            The Modern<br/>Heirloom
          </h1>
          <Link
            href="/(store)/products/collections"
            className="inline-block bg-foreground text-background font-sans text-[10px] tracking-[0.24em] uppercase px-10 py-5 hover:bg-primary transition-colors duration-300"
          >
            Shop the Collection
          </Link>
        </div>
      </div>
    </section>
  );
}
