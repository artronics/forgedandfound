import {GetCollectionByHandleDocument, ProductCollectionSortKeys} from "@/graphql/generated/graphql";
import {skipToken, useQuery} from "@apollo/client/react";

const PAGE_SIZE = 1;

export function useCollection(
  {
    handle,
    filters = [],
    sortKey = "MANUAL",
    reverse = true,
  }: {
    handle?: string,
    filters?: any,
    sortKey?: ProductCollectionSortKeys,
    reverse?: boolean
  }) {
  const {data, loading, error, fetchMore} = useQuery(
    GetCollectionByHandleDocument,
    handle ? {
      variables: {
        handle,
        first: PAGE_SIZE,
        filters,
        sortKey,
        reverse,
      }, fetchPolicy: "cache-first",
    } : skipToken,
  );

  return {data, loading, error, fetchMore};
}
