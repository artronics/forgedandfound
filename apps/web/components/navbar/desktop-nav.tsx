"use client";

import Link from "next/link";
import {useState} from "react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {type Menu as MenuEntry, type MenuGroup} from "@/lib/menu/menu";

function MenuColumn({group}: { group: MenuGroup }) {
  return (
    <div className="flex flex-col gap-2.5">
      {group.label && <p className="title-xs text-ring">{group.label}</p>}
      <ul className="flex flex-col gap-0.5">
        {group.items.map(item => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block py-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MegaMenuPanel({menuItem}: { menuItem: MenuEntry }) {
  return (
    <div className="flex gap-10 px-2 justify-self-center py-8 w-full max-w-7xl">
      <div className="flex flex-col gap-2 min-w-30">
        {menuItem.href === "#" ? (
          <span className="text-3xl font-serif text-foreground">{menuItem.label}</span>
        ) : (
          <>
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
          </>
        )}
      </div>

      <Separator orientation="vertical"/>

      <div className="flex gap-10">
        {menuItem.groups.map(group => (
          <MenuColumn key={group.label} group={group}/>
        ))}
      </div>

      {/* Reserved slot for a featured product image per collection (later fed
          by a collection metafield). A quiet block for now. */}
      <div className="ml-auto flex gap-10">
        <div className="w-px shrink-0 bg-border"/>
        <div className="aspect-3/4 w-40 bg-muted"/>
      </div>
    </div>
  );
}

export function DesktopNav({menu, className}: { menu: MenuEntry[], className?: string }) {
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
            asChild={item.href !== "#"}
          >
            {item.href === "#" ? item.label : <Link href={item.href}>{item.label}</Link>}
          </Button>
        ))}
      </nav>

      {activeItem && activeItem.groups.length > 0 && (
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
