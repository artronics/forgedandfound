"use client";

import React from "react";
import {DesktopNav} from "@/components/navbar/desktop-nav";
import {NavActions} from "@/components/navbar/nav-actions";
import {MenuSheet} from "@/components/navbar/MenuSheet";
import {Brand} from "@/components/brand";
import {type Menu} from "@/lib/menu/menu";

function DesktopLayout({menu}: { menu: Menu[] }) {
  return (
    <>
      <Brand size="lg"/>
      <DesktopNav menu={menu} className="flex-1"/>
      <NavActions/>
    </>
  );
}

function MobileLayout({menu}: { menu: Menu[] }) {
  return (
    <>
      <MenuSheet menu={menu}/>
      <div className="flex flex-1 justify-center">
        <Brand size="sm" variant="wordmark"/>
      </div>
      <NavActions/>
    </>
  );
}

function TabletLayout({menu}: { menu: Menu[] }) {
  return (
    <>
      <Brand size="md"/>
      <DesktopNav menu={menu} className="flex-1"/>
      <NavActions/>
    </>
  );
}

// Which layout shows is decided by CSS, not JS: the server can't know the
// viewport width, so branching the rendered tree on a measured breakpoint used
// to desync server and client markup and break hydration. Rendering all three
// and toggling visibility with Tailwind keeps the markup identical on both
// sides. Layout tiers: mobile < md, tablet md–lg, desktop ≥ lg.
export function Navbar({menu}: { menu: Menu[] }) {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="flex h-16 items-center border-b border-border/40 bg-background/75 px-4 backdrop-blur-lg lg:h-20 lg:px-12">
        <div className="flex w-full items-center gap-4 md:hidden">
          <MobileLayout menu={menu}/>
        </div>
        <div className="hidden w-full items-center gap-4 md:flex lg:hidden">
          <TabletLayout menu={menu}/>
        </div>
        <div className="hidden w-full items-center gap-4 lg:flex">
          <DesktopLayout menu={menu}/>
        </div>
      </div>
    </header>
  );
}
