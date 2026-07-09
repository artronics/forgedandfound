"use client";

import {skipToken, useQuery} from "@apollo/client/react";
import {SearchProductsDocument, SearchSortKeys} from "@/graphql/generated/graphql";

const PAGE_SIZE = 12;

export function useSearch(
  {
    query,
    filters = [],
    sortKey = "RELEVANCE",
    reverse = false,
  }: {
    query?: string;
    filters?: object[];
    sortKey?: SearchSortKeys;
    reverse?: boolean;
  }) {
  const isActive = !!query?.trim();

  const {data, loading, error, fetchMore} = useQuery(
    SearchProductsDocument,
    isActive
      ? {
        variables: {
          query: query!,
          first: PAGE_SIZE,
          filters,
          sortKey,
          reverse,
        },
        fetchPolicy: "cache-first",
      }
      : skipToken,
  );

  return {data, loading, error, fetchMore};
}
