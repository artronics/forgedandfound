"use client";

import React, {useState} from "react";
import {
  GetCollectionByHandleDocument,
  ProductCollectionSortKeys,
  ProductFilter,
} from "@/graphql/generated/graphql";
import {useQuery} from "@apollo/client/react";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {Separator} from "@/components/ui/separator";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import {GalleryGrid} from "@/components/ui/gallery";
import {QueryGate} from "@/components/feedback";
import {FilterSortSheet} from "@/components/catalog/FilterSortSheet";
import {Pagination} from "@/components/catalog/Pagination";
import {FacetVocab, filtersToSearch} from "@/lib/catalog/facets";

const PAGE_SIZE = 12;

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

type CollectionProps = {
  handle: string;
  /** Filters resolved from the URL by the server page (filter links). */
  initialFilters?: ProductFilter[];
  /** handle <-> gid vocabulary, for writing filters back to the URL. */
  vocab?: FacetVocab;
}

export function Collection({handle, initialFilters, vocab}: CollectionProps) {
  const [filters, setFilters] = useState<ProductFilter[]>(initialFilters ?? []);
  const [sort, setSort] = useState<Sort>(SORT_OPTIONS[0]);

  // Filter changes update the URL in place (no navigation, no rerender): the
  // page stays shareable/bookmarkable and the server page re-resolves the same
  // state on a fresh load.
  const applyFilters = (next: ProductFilter[]) => {
    setFilters(next);
    if (vocab && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + filtersToSearch(next, vocab));
    }
  };
  const {data, previousData, loading, error, refetch, fetchMore} = useQuery(
    GetCollectionByHandleDocument,
    {
      variables: {
        handle,
        first: PAGE_SIZE,
        filters,
        sortKey: sort.sortKey,
        reverse: sort.reverse,
      },
      fetchPolicy: "cache-first",
    },
  );
  // Keep the previous page visible while a filter/sort change is in flight
  // instead of flashing back to the loading overlay.
  const collection = (data ?? previousData)?.collection;
  const products = collection?.products?.edges?.map(e => e.node);
  const pageInfo = collection?.products?.pageInfo;

  return (
    <QueryGate loading={loading && !collection} error={error} onRetry={() => refetch()}>
      <Page>
        <PageHeader>
          <h2>{collection?.title}</h2>
        </PageHeader>
        <PageContent>
          <div className="w-full">
            <div className="flex items-center justify-between">
              <FilterSortSheet
                totalCount={products?.length ?? 0}
                filters={collection?.products?.filters}
                selected={filters}
                sortOptions={SORT_OPTIONS}
                defaultSort={SORT_OPTIONS[0].value}
                onFiltersChange={applyFilters}
                onSortChange={(value) =>
                  setSort(SORT_OPTIONS.find((opt) => opt.value === value) ?? SORT_OPTIONS[0])}
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
    </QueryGate>
  );
}
