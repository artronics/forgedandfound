export function RelatedProducts() {
  return (
    <section className="mt-32 border-t border-border/20 pt-10">
      <div className="mb-10 flex items-baseline justify-between">
        <h2 className="font-serif italic text-3xl tracking-tight text-foreground">
          You May Also Like
        </h2>
        <a
          href="#"
          className="font-sans text-[10px] tracking-widest uppercase text-secondary hover:underline underline-offset-4 decoration-border"
        >
          Explore Heritage
        </a>
      </div>

      {/* 4-col placeholder grid — replace with real ProductCard */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            // Alternating offset replicates the staggered design
            className={i % 2 !== 0 ? "mt-8" : ""}
          >
            <div className="aspect-3/4 w-full bg-muted"/>
            <div className="mt-3 space-y-1.5">
              <div className="h-3.5 w-2/3 bg-muted"/>
              <div className="h-2.5 w-1/4 bg-muted"/>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

