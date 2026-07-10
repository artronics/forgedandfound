import {GetCollectionByHandleDocument, ProductCollectionSortKeys} from "@/graphql/generated/graphql";
import {skipToken, useQuery} from "@apollo/client/react";
import {FilterInput} from "@/components/collection/Collection";

const PAGE_SIZE = 1;

export function useCollection(
  {
    handle,
    filters = [],
    sortKey = "MANUAL",
    reverse = true,
  }: {
    handle?: string,
    filters?: FilterInput[],
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
