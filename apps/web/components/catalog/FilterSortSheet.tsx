"use client";

import React, {useState} from "react";
import type {ProductFilter} from "@/graphql/generated/graphql";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {Icon} from "@/components/ui/icon";
import {Badge} from "@/components/ui/badge";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {Separator} from "@/components/ui/separator";
import {convertFilters, SourceFilter} from "@/lib/catalog/filters";
import {filterEquals} from "@/lib/catalog/facets";

// The filter-and-sort sheet shared by the collection and search surfaces. The
// groups render whatever Search & Discovery returned (lib/catalog/filters.ts);
// sorting differs per surface, so the options come in as plain {value, label}
// pairs and the selected value is reported back.
//
// Selection is CONTROLLED: the surface owns the ProductFilter[] (it also feeds
// the query and the URL), and a checkbox is checked iff its input is in that
// list — which is what lets a filter-link URL arrive pre-checked.

export interface SortOption {
  value: string;
  label: string;
}

type FilterSortSheetProps = {
  filters: SourceFilter[] | undefined | null;
  /** The active filter inputs. Checkbox state derives from this. */
  selected: ProductFilter[];
  sortOptions: SortOption[];
  defaultSort: string;
  onSortChange: (value: string) => void;
  onFiltersChange: (inputs: ProductFilter[]) => void;
  totalCount: number;
};

export function FilterSortSheet(
  {
    filters,
    selected,
    sortOptions,
    defaultSort,
    onSortChange,
    onFiltersChange,
    totalCount,
  }: FilterSortSheetProps) {
  const filterGroups = convertFilters(filters);
  const [open, setOpen] = useState(false);
  const [activeSort, setActiveSort] = useState(defaultSort);

  const isChecked = (input: ProductFilter) => selected.some((f) => filterEquals(f, input));

  function toggleFilter(input: ProductFilter) {
    onFiltersChange(
      isChecked(input) ? selected.filter((f) => !filterEquals(f, input)) : [...selected, input],
    );
  }

  function onSetActiveSort(value: string) {
    setActiveSort(value);
    onSortChange(value);
  }

  const activeCount = selected.length;
  const groupCount = (groupId: string) =>
    filterGroups.find((g) => g.id === groupId)?.values.filter((v) => isChecked(v.input)).length ?? 0;

  const clearAll = () => {
    onFiltersChange([]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="filter"
          className={cn(activeCount > 0 && "border-ring")}
        >
          <div className="relative pr-2">
            <Icon icon="sliders-horizontal" strokeWidth={1.5}/>
            {activeCount > 0 && (
              <Badge variant="indicator"
                     className="absolute bottom-2 right-0 size-[2ch]">
                {activeCount}
              </Badge>
            )}
          </div>
          Filters & Sort
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader className="items-start">
          <SheetTitle>
            Filters & Sort
          </SheetTitle>
          <div className="ml-auto h-8">
            {activeCount > 0 && (
              <Button
                variant="ghost"
                onClick={clearAll}
                className="cursor-pointer p-0">
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {/* Sort */}
          <div className="px-6 py-5">
            <p className="mb-3 text-2xs tracking-[0.2em] uppercase">
              Sort by
            </p>
            <div className="flex flex-col gap-2">
              {sortOptions.map((sort) => (
                <button
                  key={sort.value}
                  onClick={() => onSetActiveSort(sort.value)}
                  className={cn(
                    "cursor-pointer w-fit text-left text-sm transition-colors duration-150",
                    activeSort === sort.value
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {activeSort === sort.value && (
                    <span className="mr-2 text-secondary">—</span>
                  )}
                  {sort.label}
                </button>
              ))}
            </div>
          </div>

          <Separator/>

          {/* Filter groups */}
          <Accordion
            type="multiple"
            defaultValue={filterGroups.map((g) => g.id)}
            className="px-6"
          >
            {filterGroups.map((group) => (
              <AccordionItem
                key={group.id}
                value={group.id}
                className="border-b"
              >
                <AccordionTrigger
                  className="tracking-widest uppercase text-foreground hover:no-underline py-4">
                  {group.label}
                  {groupCount(group.id) > 0 && (
                    <span className="mx-2 text-secondary">
                      ({groupCount(group.id)})
                    </span>
                  )}
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="flex flex-col gap-3">
                    {group.values.map((v) => (
                      <div key={v.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`${group.id}-${v.id}`}
                          checked={isChecked(v.input)}
                          onCheckedChange={() => toggleFilter(v.input)}
                          disabled={v.count === 0}
                          className="cursor-pointer rounded-none border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                        />
                        <Label
                          htmlFor={`${group.id}-${v.id}`}
                          variant="option"
                        >
                          {v.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-5">
          <Button
            onClick={() => setOpen(false)}
            className="w-full text-xs"
          >
            View {totalCount ?? ""} results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
