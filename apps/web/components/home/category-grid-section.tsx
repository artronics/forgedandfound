import Link from "next/link";

type CategoryTile = {
  label: string
  subLabel?: string
  href: string
  span?: "single" | "double"
  bespoke?: boolean
}

const CATEGORIES: CategoryTile[] = [
  {label: "Necklaces", subLabel: "Explore 42 Pieces", href: "/collections/necklaces", span: "double"},
  {label: "Rings", href: "/collections/rings", span: "single"},
  {label: "Earrings", href: "/collections/earrings", span: "single"},
  {
    label: "Bespoke Commissions",
    subLabel: "Work directly with our lead artisan to create a singular piece of history.",
    href: "/bespoke",
    span: "double",
    bespoke: true,
  },
];

function CategoryTile({tile}: { tile: CategoryTile }) {
  const isDouble = tile.span === "double";
  const isBespoke = tile.bespoke;

  return (
    <Link
      href={tile.href}
      className={`
        relative group overflow-hidden cursor-pointer
        ${isDouble ? "md:col-span-2" : "md:col-span-1"}
      `}
    >
      {/* Image placeholder */}
      <div className="absolute inset-0 bg-muted group-hover:scale-105 transition-transform duration-1000"/>

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-foreground/20 group-hover:bg-foreground/40 transition-colors duration-300"/>

      {isBespoke ? (
        // Centred bespoke layout
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center h-full px-10 py-20 min-h-80">
          <h3 className="font-serif italic text-4xl text-background mb-4">
            {tile.label}
          </h3>
          {tile.subLabel && (
            <p className="font-sans text-sm font-light text-background/80 max-w-sm mb-8 leading-relaxed">
              {tile.subLabel}
            </p>
          )}
          <span
            className="font-sans text-[10px] tracking-[0.24em] uppercase text-background border border-background/30 px-6 py-2.5 hover:border-background/70 transition-colors">
            Learn More
          </span>
        </div>
      ) : (
        // Bottom-left label layout
        <div className="relative z-10 flex flex-col justify-end h-full px-8 py-8 min-h-80">
          <h3 className={`font-serif italic text-background ${isDouble ? "text-3xl" : "text-2xl"}`}>
            {tile.label}
          </h3>
          {tile.subLabel && (
            <span className="font-sans text-[10px] tracking-[0.24em] uppercase text-background/80 mt-1">
              {tile.subLabel}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export function CategoryGridSection() {
  return (
    <section className="bg-surface-low py-28 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 space-y-3">
          <h2 className="font-serif italic text-4xl text-foreground">
            Explore the Vault
          </h2>
          <p className="font-sans text-sm font-light text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Discover pieces designed to be lived in and passed through generations.
          </p>
        </div>

        {/* Bento grid — fixed height on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-160">
          {CATEGORIES.map((tile) => (
            <CategoryTile key={tile.label} tile={tile}/>
          ))}
        </div>
      </div>
    </section>
  );
}
