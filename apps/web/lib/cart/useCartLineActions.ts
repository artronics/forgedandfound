import {useState} from "react";
import {useMutation} from "@apollo/client/react";
import {browserLogger} from "@forgedandfound/logger/browser";
import {useCartId} from "@/lib/cart/useCartId.store";
import {
  CartLineUpdateDocument,
  CartLineUpdateMutation,
  CartLineUpdateMutationVariables,
} from "@/graphql/generated/graphql";
import {getMaxQuantity, setMaxQuantity} from "@/lib/cart/max-quantity";

type ExistingLine = {
  id: string;
  quantity: number;
};

export function useCartLineActions(line?: ExistingLine) {
  const cartId = useCartId();
  const [userError, setUserError] = useState<Error | null>(null);

  const [updateLine, {loading, error}] =
    useMutation<CartLineUpdateMutation, CartLineUpdateMutationVariables>(CartLineUpdateDocument);

  if (!line) {
    return {
      quantity: 0, loading, error: null, maxStock: null, isMaxStocked: false, inc: () => {
      },
    };
  }

  const quantity = line.quantity;
  const maxStock = getMaxQuantity(line?.id);
  const isMaxStocked = maxStock !== null && quantity >= maxStock;

  const syncLineQuantity = async (nextQuantity: number) => {
    if (!cartId) return;

    const result = await updateLine({
      variables: {
        cartId,
        line: {id: line.id, quantity: nextQuantity},
      },
      update(_, {data}) {
        const warning = data?.cartLinesUpdate?.warnings?.find((w) => w.target === line.id);
        if (warning?.code === "MERCHANDISE_NOT_ENOUGH_STOCK") {
          setMaxQuantity(line.id, quantity);
        }
      },
    });

    // Shopify reports validation problems as userErrors on an otherwise
    // successful response; surface them like transport errors.
    const userErrors = result.data?.cartLinesUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      browserLogger.warn({userErrors}, "cartLinesUpdate returned user errors");
      setUserError(new Error(userErrors.map((e) => e.message).join(", ")));
    } else {
      setUserError(null);
    }
  };

  const inc = async () => {
    if (isMaxStocked) return;
    await syncLineQuantity(quantity + 1);
  };

  const dec = async () => {
    if (quantity <= 0) return;
    await syncLineQuantity(Math.max(0, quantity - 1));
  };

  const remove = async () => {
    await syncLineQuantity(0);
  };

  return {
    quantity,
    loading,
    error: error ?? userError,
    maxStock,
    isMaxStocked,
    inc,
    dec,
    remove,
  };
}