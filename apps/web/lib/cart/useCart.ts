import {useCartId} from "@/lib/cart/useCartId.store";
import {skipToken, useQuery} from "@apollo/client/react";
import {CartGetDocument} from "@/graphql/generated/graphql";

export function useCart() {
  const cartId = useCartId();
  const {data, loading, error} = useQuery(
    CartGetDocument,
    cartId
      ? {
        variables: {cartId},
      } : skipToken,
  );

  return {data, loading, error};
}