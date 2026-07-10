import React, {useState} from "react";
import {
  Filters_ProductFragment,
  Filters_ProductFragmentDoc,
  ProductCollectionSortKeys,
} from "@/graphql/generated/graphql";
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger} from "@/components/ui/sheet";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {Icon} from "@/components/ui/icon";
import {Badge} from "@/components/ui/badge";
import {FragmentType, useFragment} from "@/graphql/generated";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {useCollection} from "@/lib/collection/useCollection";
import {Separator} from "@/components/ui/separator";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import {GalleryGrid} from "@/components/ui/gallery";

type Sort = {
  value: "featured" | "newest" | "price-asc" | "price-desc" | "bestselling";
  label: string;
  sortKey: ProductCollectionSortKeys;
  reverse?: boolean;
}
const SORT_OPTIONS: Sort[] = [
  {value: "featured", label: "Featured", sortKey: "MANUAL", reverse: true},
  {value: "newest", label: "Newest", sortKey: "CREATED"},
  {value: "price-asc", label: "Price: Low to High", sortKey: "PRICE"},
  {value: "price-desc", label: "Price: High to Low", sortKey: "PRICE", reverse: true},
  {value: "bestselling", label: "Bestselling", sortKey: "BEST_SELLING"},
];

export type FilterInput = {
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
  groupName?: string;
}

type FilterGroup =
  {
    id: string;
    type: "design"
    label: "By Design"
    filters: Filter[]
  } | {
  id: string;
  type: "colour"
  label: "By Colour"
  filters: Filter[]
} | {
  id: string;
  type: "material"
  label: "By Material"
  filters: Filter[]
}

type CollectionProps = {
  handle: string;
}

export function Collection({handle}: CollectionProps) {
  const [filters, setFilters] = useState<FilterInput[]>([]);
  const [sort, setSort] = useState<Sort>(SORT_OPTIONS[0]);
  const {data, loading, error, fetchMore} = useCollection({
    handle,
    filters,
    sortKey: sort.sortKey,
    reverse: sort.reverse,
  });
  const collection = data?.collection;
  const products = collection?.products?.edges?.map(e => e.node);
  const pageInfo = data?.collection?.products?.pageInfo;

  const onFiltersChange = (filters: Filter[]) => {
    setFilters(filters.map((f: Filter) => (f.input)));
  };

  return (
    <Page>
      <PageHeader>
        <h2>{data?.collection?.title}</h2>
      </PageHeader>
      <PageContent>
        <div className="w-full">
          <div className="flex items-center justify-between">
            <CollectionSheet
              totalCount={products?.length ?? 0}
              filtersFragment={collection?.products}
              onFiltersChange={onFiltersChange}
              onSortChange={setSort}
            />

          </div>
          <Separator className="my-4"/>
          <GalleryGrid>
            {products?.map(p => {
              return (<ProductItemCard key={p.id} fragment={p}/>);
            })}
          </GalleryGrid>
          <div className="mt-8">
            <div className="flex flex-col gap-12">
              <Pagination
                pageInfo={pageInfo}
                onLoadMore={(after) => fetchMore({variables: {after}})}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

type CollectionSheetProps = {
  filtersFragment: FragmentType<typeof Filters_ProductFragmentDoc> | undefined
  onFiltersChange: (filters: Filter[]) => void;
  onSortChange: (sort: Sort) => void;
  totalCount: number;
}

function CollectionSheet({filtersFragment, onFiltersChange, onSortChange, totalCount}: CollectionSheetProps) {
  const fragment = useFragment(Filters_ProductFragmentDoc, filtersFragment);
  const filterGroups = convertFilters(fragment);
  const [open, setOpen] = useState(false);

  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [activeSort, setActiveSort] = useState("featured");

  function toggleFilter(groupId: string, filter: string) {
    const next = {...activeFilters};
    if (!next[groupId]) next[groupId] = new Set();
    else next[groupId] = new Set(next[groupId]);

    if (next[groupId].has(filter)) next[groupId].delete(filter);
    else next[groupId].add(filter);


    setActiveFilters(next);
    const filtersToApply: Filter[] = filterGroups.flatMap((group) =>
      group.filters.filter((f) => next[group.id]?.has(f.id)),
    );
    onFiltersChange(filtersToApply);
  }

  function onSetActiveSort(sortKey: string) {
    setActiveSort(sortKey);
    onSortChange(SORT_OPTIONS.find((opt) => opt.value === sortKey) ?? SORT_OPTIONS[0]);
  }

  const activeCount = Object.values(activeFilters).reduce(
    (sum, set) => sum + set.size,
    0,
  );

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
              {SORT_OPTIONS.map((sort) => (
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
                  {activeFilters[group.id]?.size > 0 && (
                    <span className="mx-2 text-secondary">
                      ({activeFilters[group.id].size})
                    </span>
                  )}
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="flex flex-col gap-3">
                    {group.filters.map((f) => (
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


// filter.p.m.custom.necklace_style.gid-shopify-metaobject-192164561202  --> metaobject-192164561202 -> b64 (to obfuscate for use in query params)
function extractId(s: string) {
  const sub = "gid-shopify-";
  const id = s.substring(s.indexOf(sub), s.length).substring(sub.length);
  return Buffer.from(id, "binary").toString("base64");
}

function convertFilters(filtersFragment?: Filters_ProductFragment) {
  const filters = filtersFragment?.filters ?? [];
  const mapFilter = (groupName: string) => (v: Filters_ProductFragment["filters"][0]["values"][0]) => {
    const input = JSON.parse(v.input);
    return {
      id: extractId(v.id),
      label: v.label,
      count: v.count,
      input: input as FilterInput,
      groupName,
    };
  };

  // Styles
  const styleFilter = filters.find(f => f.type === "LIST" && f.label.toLowerCase().includes("design"));

  const designFilterGroup: FilterGroup = {
    id: styleFilter?.id ?? "designs-group",
    label: "By Design",
    type: "design",
    filters: styleFilter?.values.map(mapFilter("By Design")) ?? [],
  };

  // Materials
  const materialFilter = filters
    .find(f => f.type === "LIST" && f.label.toLowerCase().includes("material"));

  const materialFilterGroup: FilterGroup = {
    id: materialFilter?.id ?? "materials-group",
    label: "By Material",
    type: "material",
    filters: materialFilter?.values.map(mapFilter("By Material")) ?? [],
  };

  // Colours
  const colourFilter = filters
    .find(f => f.type === "LIST" && f.label.toLowerCase().includes("colour"));

  const colourFilterGroup: FilterGroup = {
    id: colourFilter?.id ?? "colours-group",
    label: "By Colour",
    type: "colour",
    filters: colourFilter?.values.map(mapFilter("By Colour")) ?? [],
  };

  return [
    designFilterGroup,
    materialFilterGroup,
    colourFilterGroup,
  ];
}

type PaginationProps = {
  loading: boolean;
  onLoadMore: (after: string | null) => void;
  count?: number;
  totalCount?: number;
  pageInfo?: { hasNextPage: boolean, endCursor: string | null };
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

function ProgressIndicator({count, totalCount}: { count: number, totalCount: number }) {
  return (
    <div className="w-full max-w-xs">
      <div className="mb-2 flex justify-between">
              <span className="font-sans text-2xs tracking-widest uppercase text-ring">
                Showing
              </span>
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
