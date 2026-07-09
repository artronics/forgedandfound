"use client";

import {skipToken, useQuery} from "@apollo/client/react";
import {
  GetProductByHandleDocument,
  GetProductByHandleQuery,
  GetProductByHandleQueryVariables,
} from "@/graphql/generated/graphql";


export function useProduct({handle}: { handle?: string }) {
  const {data, loading, error} = useQuery<GetProductByHandleQuery, GetProductByHandleQueryVariables>(
    GetProductByHandleDocument,
    handle ? {variables: {handle}, fetchPolicy: "cache-first"} : skipToken,
  );

  return {data, loading, error};
}
