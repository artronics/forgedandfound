"use client";

import React, {useState} from "react";
import {SearchProductsQuery, SearchSortKeys} from "@/graphql/generated/graphql";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";
import {Badge} from "@/components/ui/badge";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {Separator} from "@/components/ui/separator";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import {GalleryGrid} from "@/components/ui/gallery";
import {cn} from "@/lib/utils";
import {useSearch} from "@/lib/search/useSearch";

type Sort = {
  value: "relevance" | "price-asc" | "price-desc";
  label: string;
  sortKey: SearchSortKeys;
  reverse?: boolean;
}

const SORT_OPTIONS: Sort[] = [
  {value: "relevance", label: "Most Relevant", sortKey: "RELEVANCE"},
  {value: "price-asc", label: "Price: Low to High", sortKey: "PRICE"},
  {value: "price-desc", label: "Price: High to Low", sortKey: "PRICE", reverse: true},
];

type FilterInput = {
  productMetafield: {
    namespace: string;
    key: string;
    value: string;
  }
}

type Filter = {
  id: string;
  label: string;
  count: number;
  input: FilterInput;
}

type FilterGroup = {
  id: string;
  type: "design" | "colour" | "material";
  label: "By Design" | "By Colour" | "By Material";
  filters: Filter[];
}

type SearchNode = SearchProductsQuery["search"]["edges"][number]["node"];
type ProductNode = Extract<SearchNode, { __typename: "Product" }>;

function isProductNode(node: SearchNode): node is ProductNode {
  return node.__typename === "Product";
}

type SearchResultsProps = {
  query: string;
}

export function SearchResults({query}: SearchResultsProps) {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>(SORT_OPTIONS[0]);

  const {data, loading, fetchMore} = useSearch({
    query,
    filters: filters.map(f => f.input),
    sortKey: sort.sortKey,
    reverse: sort.reverse,
  });

  const searchData = data?.search;
  const edges = searchData?.edges ?? [];
  const products = edges.map(e => e.node).filter(isProductNode);
  const pageInfo = searchData?.pageInfo;
  const totalCount = searchData?.totalCount ?? 0;
  const productFilters = searchData?.productFilters ?? [];

  const onFiltersChange = (updated: Filter[]) => setFilters(updated);

  if (!query.trim()) {
    return (
      <Page>
        <PageHeader>
          <h2>Search</h2>
        </PageHeader>
        <PageContent>
          <p className="text-muted-foreground text-sm">Enter a search term to find products.</p>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader>
        <h2>Results for &ldquo;{query}&rdquo;</h2>
        {!loading && (
          <p className="text-sm text-muted-foreground tracking-wide">
            {totalCount} {totalCount === 1 ? "product" : "products"} found
          </p>
        )}
      </PageHeader>
      <PageContent>
        <div className="w-full">
          <div className="flex items-center justify-between">
            <SearchSheet
              productFilters={productFilters}
              totalCount={products.length}
              onFiltersChange={onFiltersChange}
              onSortChange={setSort}
            />
          </div>
          <Separator className="my-4"/>

          {loading && products.length === 0 && (
            <div className="flex items-center justify-center py-24">
              <span className="text-muted-foreground text-sm animate-pulse">Searching…</span>
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <p className="text-lg font-serif">No results found</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                We couldn&apos;t find anything matching &ldquo;{query}&rdquo;. Try a different search term or browse our
                collections.
              </p>
            </div>
          )}

          <GalleryGrid>
            {products.map(p => (
              <ProductItemCard key={p.id} fragment={p}/>
            ))}
          </GalleryGrid>

          {pageInfo?.hasNextPage && (
            <div className="mt-8">
              <div className="flex flex-col gap-12">
                <Pagination
                  count={products.length}
                  totalCount={totalCount}
                  pageInfo={pageInfo}
                  onLoadMore={(after) => fetchMore({variables: {after}})}
                  loading={loading}
                />
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}

type SearchSheetProps = {
  productFilters: SearchProductsQuery["search"]["productFilters"];
  onFiltersChange: (filters: Filter[]) => void;
  onSortChange: (sort: Sort) => void;
  totalCount: number;
}

function SearchSheet({productFilters, onFiltersChange, onSortChange, totalCount}: SearchSheetProps) {
  const filterGroups = convertFilters(productFilters);
  const [open, setOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [activeSort, setActiveSort] = useState("relevance");

  function toggleFilter(groupId: string, filterId: string) {
    const next = {...activeFilters};
    if (!next[groupId]) next[groupId] = new Set();
    else next[groupId] = new Set(next[groupId]);

    if (next[groupId].has(filterId)) next[groupId].delete(filterId);
    else next[groupId].add(filterId);

    setActiveFilters(next);
    const filtersToApply: Filter[] = filterGroups.flatMap(group =>
      group.filters.filter(f => next[group.id]?.has(f.id)),
    );
    onFiltersChange(filtersToApply);
  }

  function onSetActiveSort(value: string) {
    setActiveSort(value);
    onSortChange(SORT_OPTIONS.find(opt => opt.value === value) ?? SORT_OPTIONS[0]);
  }

  const activeCount = Object.values(activeFilters).reduce((sum, set) => sum + set.size, 0);

  const clearAll = () => {
    setActiveFilters({});
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
              <Badge variant="indicator" className="absolute bottom-2 right-0 size-[2ch]">
                {activeCount}
              </Badge>
            )}
          </div>
          Filters & Sort
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader className="items-start">
          <SheetTitle>Filters & Sort</SheetTitle>
          <div className="ml-auto h-8">
            {activeCount > 0 && (
              <Button variant="ghost" onClick={clearAll} className="cursor-pointer p-0">
                Clear all
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {/* Sort */}
          <div className="px-6 py-5">
            <p className="mb-3 text-2xs tracking-[0.2em] uppercase">Sort by</p>
            <div className="flex flex-col gap-2">
              {SORT_OPTIONS.map(sort => (
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
                  {activeSort === sort.value && <span className="mr-2 text-secondary">—</span>}
                  {sort.label}
                </button>
              ))}
            </div>
          </div>

          <Separator/>

          {/* Filter groups */}
          {filterGroups.some(g => g.filters.length > 0) && (
            <Accordion
              type="multiple"
              defaultValue={filterGroups.map(g => g.id)}
              className="px-6"
            >
              {filterGroups.filter(g => g.filters.length > 0).map(group => (
                <AccordionItem key={group.id} value={group.id} className="border-b">
                  <AccordionTrigger className="tracking-widest uppercase text-foreground hover:no-underline py-4">
                    {group.label}
                    {activeFilters[group.id]?.size > 0 && (
                      <span className="mx-2 text-secondary">({activeFilters[group.id].size})</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-col gap-3">
                      {group.filters.map(f => (
                        <div key={f.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`${group.id}-${f.id}`}
                            checked={activeFilters[group.id]?.has(f.id) ?? false}
                            onCheckedChange={() => toggleFilter(group.id, f.id)}
                            disabled={f.count === 0}
                            className="cursor-pointer rounded-none border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                          />
                          <Label
                            htmlFor={`${group.id}-${f.id}`}
                            variant="option"
                          >
                            {f.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <div className="px-6 py-5">
          <Button onClick={() => setOpen(false)} className="w-full text-xs">
            View {totalCount ?? ""} results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function extractId(s: string) {
  const sub = "gid-shopify-";
  const id = s.substring(s.indexOf(sub), s.length).substring(sub.length);
  return Buffer.from(id, "binary").toString("base64");
}

function convertFilters(productFilters: SearchProductsQuery["search"]["productFilters"]): FilterGroup[] {
  const mapFilter = (v: SearchProductsQuery["search"]["productFilters"][number]["values"][number]): Filter => {
    const input = JSON.parse(v.input);
    return {
      id: extractId(v.id),
      label: v.label,
      count: v.count,
      input: input as FilterInput,
    };
  };

  const styleFilter = productFilters.find(f => f.type === "LIST" && f.label.toLowerCase().includes("design"));
  const materialFilter = productFilters.find(f => f.type === "LIST" && f.label.toLowerCase().includes("material"));
  const colourFilter = productFilters.find(f => f.type === "LIST" && f.label.toLowerCase().includes("colour"));

  return [
    {
      id: styleFilter?.id ?? "designs-group",
      label: "By Design",
      type: "design",
      filters: styleFilter?.values.map(mapFilter) ?? [],
    },
    {
      id: materialFilter?.id ?? "materials-group",
      label: "By Material",
      type: "material",
      filters: materialFilter?.values.map(mapFilter) ?? [],
    },
    {
      id: colourFilter?.id ?? "colours-group",
      label: "By Colour",
      type: "colour",
      filters: colourFilter?.values.map(mapFilter) ?? [],
    },
  ];
}

type PaginationProps = {
  loading: boolean;
  onLoadMore: (after: string | null) => void;
  count?: number;
  totalCount?: number;
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
};

function Pagination({count, totalCount, pageInfo, onLoadMore, loading}: PaginationProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {count && totalCount && <ProgressIndicator count={count} totalCount={totalCount}/>}
      <Button
        variant="outline"
        size="wide"
        onClick={() => onLoadMore(pageInfo?.endCursor ?? null)}
        disabled={loading}
      >
        {loading ? "Loading…" : "Load More"}
      </Button>
    </div>
  );
}

function ProgressIndicator({count, totalCount}: { count: number; totalCount: number }) {
  return (
    <div className="w-full max-w-xs">
      <div className="mb-2 flex justify-between">
        <span className="font-sans text-2xs tracking-widest uppercase text-ring">Showing</span>
        <span className="font-sans text-2xs tracking-widest uppercase text-ring">
          {count} of {totalCount}
        </span>
      </div>
      <div className="h-px w-full bg-border">
        <div
          className="h-px bg-foreground transition-all duration-500"
          style={{width: `${(count / totalCount) * 100}%`}}
        />
      </div>
    </div>
  );
}
