"use client";

import React from "react";
import {DesktopNav} from "@/components/navbar/desktop-nav";
import {NavActions} from "@/components/navbar/nav-actions";
import {MenuSheet} from "@/components/navbar/MenuSheet";
import {Brand} from "@/components/brand";
import {useBreakpoint} from "@/lib/layout/BreakpointProvider";

function DesktopLayout() {
  return (
    <>
      <Brand size="lg"/>
      <DesktopNav className="flex-1"/>
      <NavActions/>
    </>
  );
}

function MobileLayout() {
  return (
    <>
      <MenuSheet/>
      <div className="flex flex-1 justify-center">
        <Brand size="sm" variant="wordmark"/>
      </div>
      <NavActions/>
    </>
  );
}

function TabletLayout() {
  return (
    <>
      <Brand size="md"/>
      <DesktopNav className="flex-1"/>
      <NavActions/>
    </>
  );
}

export function Navbar() {
  const {isDesktop, isTablet} = useBreakpoint();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="flex h-16 items-center gap-4 border-b border-border/40 bg-background/75 px-4 backdrop-blur-lg lg:h-20 lg:px-12">
        {isDesktop
          ? <DesktopLayout/>
          : isTablet
            ? <TabletLayout/>
            : <MobileLayout/>}
      </div>
    </header>
  );
}
