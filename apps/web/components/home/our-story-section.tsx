"use client";
import Link from "next/link";
import {ArrowRight} from "lucide-react";

export function OurStorySection() {
  return (
    <section className="py-28 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24 items-center">

        {/* Image — left */}
        <div className="relative">
          <div className="aspect-3/4 bg-muted w-full"/>
          {/* Inset label card */}
          <div
            className="absolute -bottom-8 -right-8 hidden md:flex w-44 h-44 bg-surface-low items-center justify-center p-6 border border-border/30">
            <p
              className="font-sans text-2xs tracking-widest uppercase text-ring text-center leading-relaxed">
              Established in the Highlands, 1984
            </p>
          </div>
        </div>

        {/* Text — right */}
        <div className="space-y-8">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-secondary block">
            The Maker's Mark
          </span>

          <h2 className="font-serif italic text-5xl font-light text-foreground leading-tight">
            Forged in tradition,<br/>found in the wild.
          </h2>

          <div className="space-y-5">
            <p className="font-sans text-base font-light leading-loose text-muted-foreground">
              Every piece at Forged &amp; Found is a testament to the enduring beauty of raw
              materials. We believe in slow craftsmanship, sourcing our metals ethically and
              allowing the natural imperfections of stones to guide our design.
            </p>
            <p className="font-sans text-base font-light leading-loose text-muted-foreground">
              Our studio isn't just a workshop; it's a sanctuary where heritage techniques
              meet a modern, minimalist eye.
            </p>
          </div>

          <Link
            href="/heritage"
            className="inline-flex items-center gap-3 font-sans text-[11px] tracking-[0.2em] uppercase text-foreground group"
          >
            Our Heritage
            <ArrowRight
              size={14}
              strokeWidth={1.5}
              className="transition-transform duration-200 group-hover:translate-x-1.5"
            />
          </Link>
        </div>

      </div>
    </section>
  );
}
