"use client";

import Image from "next/image";
import Link from "next/link";
import {useState} from "react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {type Menu as MenuEntry, type MenuImage, type MenuItem, useMenu} from "@/lib/menu/useMenu";
import {CyclingImage} from "@/components/navbar/CyclingImage";

type NonNullMenuImage = NonNullable<MenuImage>;

function MenuColumn(
  {
    heading,
    items,
    onItemHover,
  }: {
    heading: string;
    items: MenuItem[];
    onItemHover: (images: NonNullMenuImage[] | null) => void;
  }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="title-xs text-ring">{heading}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map(item => {
          const images = (item.image ?? []).filter(
            (img): img is NonNullMenuImage => img !== null,
          );
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onMouseEnter={() => onItemHover(images.length > 0 ? images : null)}
                onMouseLeave={() => onItemHover(null)}
                className="block py-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeaturedImage(
  {
    defaultImage,
    hoveredImages,
  }: {
    defaultImage: NonNullMenuImage;
    hoveredImages: NonNullMenuImage[] | null;
  }) {
  return (
    <div className="aspect-3/4 w-40 overflow-hidden bg-muted">
      {hoveredImages ? (
        <CyclingImage images={hoveredImages} className="w-full h-full object-cover"/>
      ) : (
        <Image
          src={defaultImage.url}
          alt={defaultImage.altText ?? ""}
          width={defaultImage.width ?? 400}
          height={defaultImage.height ?? 400}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

function MegaMenuPanel({menuItem}: { menuItem: MenuEntry }) {
  const defaultImage = menuItem.image ?? null;
  const [hoveredImages, setHoveredImages] = useState<NonNullMenuImage[] | null>(null);

  return (
    <div
      className="flex gap-10 px-2 justify-self-center py-8 w-full max-w-7xl"
      onMouseLeave={() => setHoveredImages(null)}
    >
      <div className="flex flex-col gap-2 min-w-30">
        <Link
          href={menuItem.href}
          className="text-3xl font-serif text-foreground hover:text-secondary transition-colors duration-150"
        >
          {menuItem.label}
        </Link>
        <Link
          href={menuItem.href}
          className="title-xs text-ring hover:surface-foreground transition-colors duration-150"
        >
          View all →
        </Link>
      </div>

      <Separator orientation="vertical"/>

      <div className="flex gap-10">
        {menuItem.groups.map(group => (
          <MenuColumn
            key={group.label}
            heading={group.label}
            items={group.items}
            onItemHover={setHoveredImages}
          />
        ))}
      </div>

      {defaultImage && (
        <>
          <div className="ml-auto w-px shrink-0 bg-border"/>
          <FeaturedImage defaultImage={defaultImage} hoveredImages={hoveredImages}/>
        </>
      )}
    </div>
  );
}

export function DesktopNav({className}: { className?: string }) {
  const {menu} = useMenu();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const activeItem = menu.find(m => m.label === activeLabel) ?? null;

  return (
    <div className={cn("flex flex-1 justify-center", className)}>
      <nav className="flex items-center">
        {menu.map(item => (
          <Button
            variant="ghost"
            key={item.label}
            onMouseEnter={() => setActiveLabel(item.label)}
            className={cn(
              "title-lg px-2 xl:px-4 hover:bg-transparent",
              activeLabel === item.label && "text-primary",
            )}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {activeItem && (
        <div
          onMouseEnter={() => setActiveLabel(activeItem.label)}
          onMouseLeave={() => setActiveLabel(null)}
          className={cn(
            "absolute left-0 top-full w-full z-40",
            "bg-background border-b border-border",
            "animate-in fade-in-0 slide-in-from-top-1 duration-200",
          )}
        >
          <MegaMenuPanel menuItem={activeItem}/>
        </div>
      )}
    </div>
  );
}
