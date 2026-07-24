"use client";

import React, {useState} from "react";
import {
  ProductFilter,
  SearchProductsDocument,
  SearchProductsQuery,
  SearchSortKeys,
} from "@/graphql/generated/graphql";
import {skipToken, useQuery} from "@apollo/client/react";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {Separator} from "@/components/ui/separator";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import {GalleryGrid} from "@/components/ui/gallery";
import {QueryGate} from "@/components/feedback";
import {FilterSortSheet} from "@/components/catalog/FilterSortSheet";
import {Pagination} from "@/components/catalog/Pagination";

const PAGE_SIZE = 12;

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

type SearchNode = SearchProductsQuery["search"]["edges"][number]["node"];
type ProductNode = Extract<SearchNode, { __typename: "Product" }>;

function isProductNode(node: SearchNode): node is ProductNode {
  return node.__typename === "Product";
}

type SearchResultsProps = {
  query: string;
}

export function SearchResults({query}: SearchResultsProps) {
  const [filters, setFilters] = useState<ProductFilter[]>([]);
  const [sort, setSort] = useState<Sort>(SORT_OPTIONS[0]);

  const isActive = !!query.trim();
  const {data, previousData, loading, error, refetch, fetchMore} = useQuery(
    SearchProductsDocument,
    isActive
      ? {
        variables: {
          query,
          first: PAGE_SIZE,
          filters,
          sortKey: sort.sortKey,
          reverse: sort.reverse,
        },
        fetchPolicy: "cache-first",
      }
      : skipToken,
  );

  // Keep the previous results visible while a filter/sort change is in flight.
  const searchData = (data ?? previousData)?.search;
  const edges = searchData?.edges ?? [];
  const products = edges.map(e => e.node).filter(isProductNode);
  const pageInfo = searchData?.pageInfo;
  const totalCount = searchData?.totalCount ?? 0;

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
    <QueryGate loading={loading && !searchData} error={error} onRetry={() => refetch()}>
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
            <FilterSortSheet
              filters={searchData?.productFilters}
              selected={filters}
              totalCount={products.length}
              sortOptions={SORT_OPTIONS}
              defaultSort={SORT_OPTIONS[0].value}
              onFiltersChange={setFilters}
              onSortChange={(value) =>
                setSort(SORT_OPTIONS.find((opt) => opt.value === value) ?? SORT_OPTIONS[0])}
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
    </QueryGate>
  );
}
