import {skipToken, useQuery} from "@apollo/client/react";
import {GetWishlistProductsDocument} from "@/graphql/generated/graphql";

export function useFavouriteProducts({ids}: { ids: string[] }) {
  const {data, loading, error} = useQuery(GetWishlistProductsDocument,
    ids.length > 0
      ? {variables: {ids}}
      : skipToken,
  );

  return {data, loading, error};
}