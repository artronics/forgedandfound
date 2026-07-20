import {useState} from "react";
import {useCartId} from "@/lib/cart/useCartId.store";
import {useMutation} from "@apollo/client/react";
import {browserLogger} from "@forgedandfound/logger/browser";
import {CartLineAddDocument, CartLineAddMutation, CartLineAddMutationVariables} from "@/graphql/generated/graphql";
import {setMaxQuantity} from "@/lib/cart/max-quantity";

export function useAddToCart() {
  const cartId = useCartId();
  const [userError, setUserError] = useState<Error | null>(null);
  const [addLine, {
    loading,
    error,
  }] = useMutation<CartLineAddMutation, CartLineAddMutationVariables>(CartLineAddDocument);

  const addToCart = async (variantId: string, quantity: number = 1) => {
    if (!cartId) return;
    const result = await addLine({
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

    // Shopify reports validation problems as userErrors on an otherwise
    // successful response; surface them like transport errors.
    const userErrors = result.data?.cartLinesAdd?.userErrors ?? [];
    if (userErrors.length > 0) {
      browserLogger.warn({userErrors}, "cartLinesAdd returned user errors");
      setUserError(new Error(userErrors.map((e) => e.message).join(", ")));
    } else {
      setUserError(null);
    }
  };

  return {
    addToCart,
    loading,
    error: error ?? userError,
  };
}
