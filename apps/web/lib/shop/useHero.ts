"use client";
import {useQuery} from "@apollo/client/react";
import {GetShopDocument} from "@/graphql/generated/graphql";

export function useHero() {
  const {data, loading, error} = useQuery(
    GetShopDocument,
    {variables: {namespace: "ff_shop", heroKey: "hero_image"}, fetchPolicy: "cache-first"},
  );

  return {data, loading, error};
}