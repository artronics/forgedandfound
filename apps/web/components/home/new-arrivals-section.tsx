import Link from "next/link";

// Placeholder product card — replace with real ProductCard component
function ProductCardPlaceholder({
                                  title,
                                  subtitle,
                                  price,
                                  offset = false,
                                }: {
  title: string
  subtitle: string
  price: string
  offset?: boolean
}) {
  return (
    <div className={`group cursor-pointer ${offset ? "md:mt-12" : ""}`}>
      <div className="aspect-4/5 bg-muted overflow-hidden mb-5">
        {/* Replace with <Image> */}
      </div>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-serif italic text-xl text-foreground">{title}</h3>
          <p className="font-sans text-[10px] tracking-widest uppercase text-ring">
            {subtitle}
          </p>
        </div>
        <span className="font-sans text-sm font-light text-muted-foreground shrink-0 ml-4">
          {price}
        </span>
      </div>
    </div>
  );
}

export function NewArrivalsSection() {
  return (
    <section className="py-28 px-6 lg:px-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-14">
        <div className="space-y-2">
          <span className="font-sans text-[10px] tracking-[0.26em] uppercase text-ring block">
            Selected Works
          </span>
          <h2 className="font-serif italic text-4xl text-foreground">
            New Arrivals
          </h2>
        </div>
        <Link
          href="/(store)/collections/new-arrivals"
          className="font-sans text-[10px] tracking-widest uppercase text-muted-foreground border-b border-border pb-0.5 hover:text-secondary hover:border-secondary transition-colors"
        >
          View All
        </Link>
      </div>

      {/* 3-col asymmetric grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <ProductCardPlaceholder
          title="Foundry Signet Ring"
          subtitle="Recycled 18k Gold"
          price="$1,250"
        />
        <ProductCardPlaceholder
          title="Ember Drop Earrings"
          subtitle="Hand-forged Brass"
          price="$420"
          offset
        />
        <ProductCardPlaceholder
          title="Arcane Link Necklace"
          subtitle="Polished Vermeil"
          price="$890"
        />
      </div>
    </section>
  );
}
