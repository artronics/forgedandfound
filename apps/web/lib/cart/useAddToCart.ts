import {useCartId} from "@/lib/cart/useCartId.store";
import {useMutation} from "@apollo/client/react";
import {CartLineAddDocument, CartLineAddMutation, CartLineAddMutationVariables} from "@/graphql/generated/graphql";
import {setMaxQuantity} from "@/lib/cart/max-quantity";

export function useAddToCart() {
  const cartId = useCartId();
  const [addLine, {
    loading,
    error,
  }] = useMutation<CartLineAddMutation, CartLineAddMutationVariables>(CartLineAddDocument);

  const addToCart = async (variantId: string, quantity: number = 1) => {
    if (!cartId) return;
    await addLine({
      variables: {
        cartId: cartId,
        line: {merchandiseId: variantId, quantity},
      },
      update(_, {data}) {
        const lineId = data?.cartLinesAdd?.cart?.lines.nodes.find(l => l.merchandise.id === variantId)?.id;
        if (!lineId) return;
        const warning = data?.cartLinesAdd?.warnings?.find((w) => w.target === lineId);
        if (warning?.code === "MERCHANDISE_NOT_ENOUGH_STOCK") {
          const currentQty = data?.cartLinesAdd?.cart?.lines.nodes.find(l => l.id === lineId)?.quantity ?? null;
          if (currentQty === null) return;
          setMaxQuantity(lineId, currentQty);
        }
      },
    });
  };

  return {
    addToCart,
    loading,
    error: error ?? null,
  };
}