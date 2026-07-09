"use client";

import React from "react";
import {Sheet, SheetContent, SheetDescription, SheetTitle} from "@/components/ui/sheet";
import {Search} from "@/components/search/Search";
import {useSearchSheet} from "@/lib/search/useSearchSheet";

export function SearchSheet() {
  const {open, setOpen} = useSearchSheet();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetDescription aria-describedby="search-drawer"/>
      <SheetTitle/>
      <SheetContent side="top" className="w-full pt-8">
        <Search onClose={() => setOpen(false)}/>
      </SheetContent>
    </Sheet>
  );
}
