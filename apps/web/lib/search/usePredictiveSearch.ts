"use client";

import {skipToken, useQuery} from "@apollo/client/react";
import {PredictiveSearchDocument} from "@/graphql/generated/graphql";
import {useEffect, useState} from "react";

const MIN_QUERY_LENGTH = 2;

export function usePredictiveSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isActive = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  const {data, loading} = useQuery(
    PredictiveSearchDocument,
    isActive
      ? {variables: {query: debouncedQuery, limit: 5}, fetchPolicy: "cache-first"}
      : skipToken,
  );

  const products = data?.predictiveSearch?.products ?? [];
  const queries = data?.predictiveSearch?.queries ?? [];

  return {
    products,
    queries,
    loading: loading && isActive,
    debouncedQuery,
    isActive,
  };
}
