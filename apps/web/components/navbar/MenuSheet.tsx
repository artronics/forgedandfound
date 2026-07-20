"use client";

import Link from "next/link";
import React, {useState} from "react";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {Brand} from "@/components/brand";
import {type Menu as MenuEntry} from "@/lib/menu/menu";

function DrawerLink({href, onClose, children}: { href: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        "block px-6 py-2.5 text-sm text-muted-foreground",
        "hover:text-foreground hover:bg-card transition-colors duration-150",
      )}
    >
      {children}
    </Link>
  );
}

function DrawerCategory({menuItem, onClose}: { menuItem: MenuEntry; onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 focus:outline-none">
          <span className="text-[11px] tracking-widest uppercase text-foreground">
            {menuItem.label}
          </span>
          <Icon
            icon="chevron-down"
            strokeWidth={1.5}
            className={cn(
              "text-ring transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="bg-muted pb-3 pt-1">
            {menuItem.groups.map(group => (
              <div key={group.label} className="mb-4">
                <p className="px-6 pb-1 pt-2 text-[9px] tracking-[0.2em] uppercase text-ring">
                  {group.label}
                </p>
                {group.items.map(item => (
                  <DrawerLink key={item.href} href={item.href} onClose={onClose}>
                    {item.label}
                  </DrawerLink>
                ))}
              </div>
            ))}
            <div className="mt-2 border-t border-border/40 px-6 pt-3">
              <Link
                href={menuItem.href}
                onClick={onClose}
                className="text-[10px] tracking-[0.16em] uppercase text-ring hover:text-foreground transition-colors duration-150"
              >
                View all {menuItem.label} →
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function MenuSheet({menu}: { menu: MenuEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} aria-describedby="menu-drawer" onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button aria-label="Open menu" variant="ghost" className="lg:hidden">
          <Icon icon="menu" size="md"/>
        </Button>
      </SheetTrigger>

      <SheetContent side="left">
        <SheetHeader className="h-14">
          <Brand size="sm"/>
          <SheetTitle/>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto">
          {menu.map(item => (
            <DrawerCategory
              key={item.label}
              menuItem={item}
              onClose={() => setOpen(false)}
            />
          ))}
        </nav>

        {/* TODO: wire up account and help links to CMS/menu data when available */}
        <div className="border-t border-border px-6 py-5 flex flex-col gap-3">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            My Account
          </Link>
          <Link
            href="/help"
            onClick={() => setOpen(false)}
            className="tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            Help & FAQs
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
