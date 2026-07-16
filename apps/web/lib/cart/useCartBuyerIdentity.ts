"use client";

import {useEffect, useRef} from "react";
import {useSession} from "next-auth/react";
import {useMutation} from "@apollo/client/react";
import {browserLogger} from "@forgedandfound/logger/browser";
import {CartBuyerIdentityUpdateDocument} from "@/graphql/generated/graphql";
import {useCartId} from "@/lib/cart/useCartId.store";

export function useCartBuyerIdentity() {
  const {data: session, status} = useSession();
  const cartId = useCartId();
  const syncedRef = useRef<string | null>(null);

  const [updateBuyerIdentity] = useMutation(CartBuyerIdentityUpdateDocument);

  useEffect(() => {
    if (status === "loading") return;
    if (!cartId) return;

    const email = session?.user?.email ?? null;
    const syncKey = `${cartId}:${email}`;

    if (syncedRef.current === syncKey) return;
    syncedRef.current = syncKey;

    updateBuyerIdentity({
      variables: {
        cartId,
        buyerIdentity: {email: email ?? undefined},
      },
    }).catch((err) => {
      browserLogger.error(err, "cartBuyerIdentity: failed to update buyer identity");
    });
  }, [cartId, session, status, updateBuyerIdentity]);
}
