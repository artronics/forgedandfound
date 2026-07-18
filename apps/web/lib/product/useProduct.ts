"use client";

import {skipToken, useQuery} from "@apollo/client/react";
import {GetProductByHandleDocument} from "@/graphql/generated/graphql";
import {useEffect} from "react";
import {pushEvent} from "@/lib/analytics";


export function useProduct({handle}: { handle?: string }) {
  const {data, loading, error} = useQuery(
    GetProductByHandleDocument,
    handle ? {variables: {handle}, fetchPolicy: "cache-first"} : skipToken,
  );
  const id = data?.product?.id
  useEffect(() => {
    if (data?.product) {
      pushEvent(data.product)
    }
  }, [id]);

  return {data, loading, error};
}
