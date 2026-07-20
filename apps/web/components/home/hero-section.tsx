import Link from "next/link";
import Image from "next/image";
import {getLogger} from "@forgedandfound/logger/web";
import {getHeroImage} from "@/lib/shopify/server";

export async function HeroSection() {
  // A missing hero image should not take down the home page.
  const hero = await getHeroImage().catch((err) => {
    getLogger().error({err}, "failed to load hero image");
    return null;
  });

  return (
    <section className="relative h-[90vh] min-h-150 flex items-center overflow-hidden px-6 lg:px-10">
      {/* Background image placeholder */}
      <div className="absolute inset-0 z-0 bg-muted">
        {hero?.url && <Image src={hero.url} fill alt={hero.altText ?? ""}/>}
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
