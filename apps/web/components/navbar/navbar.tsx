"use client";

import React from "react";
import {DesktopNav} from "@/components/navbar/desktop-nav";
import {NavActions} from "@/components/navbar/nav-actions";
import {MenuSheet} from "@/components/navbar/MenuSheet";
import {Brand} from "@/components/brand";
import {useBreakpoint} from "@/lib/layout/BreakpointProvider";
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

export function Navbar({menu}: { menu: Menu[] }) {
  const {isDesktop, isTablet} = useBreakpoint();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="flex h-16 items-center gap-4 border-b border-border/40 bg-background/75 px-4 backdrop-blur-lg lg:h-20 lg:px-12">
        {isDesktop
          ? <DesktopLayout menu={menu}/>
          : isTablet
            ? <TabletLayout menu={menu}/>
            : <MobileLayout menu={menu}/>}
      </div>
    </header>
  );
}
