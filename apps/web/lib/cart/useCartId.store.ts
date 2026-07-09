"use client";

import {useEffect, useSyncExternalStore} from "react";
import {ApolloClient} from "@apollo/client-integration-nextjs";
import {
  CartCreateDocument,
  CartCreateMutation,
  CartCreateMutationVariables,
  CartGetDocument,
  CartGetQuery,
  CartGetQueryVariables,
} from "@/graphql/generated/graphql";
import {apolloStorefrontClient} from "@/lib/shopify/client/storefront-client";

const CART_ID_STORAGE_KEY = "shopify-cart-id";
const CART_ID_CHANGE_EVENT = "cart-id-change";

// There two sections. The external store is used to store the cart id in the browser between tabs.
// The hook is used to ensure that the cart id is always available in the client.
// The ensureCartPromise is used to prevent duplicate execution in the same tab

const hasWindow = () => typeof window !== "undefined";

function readStoredCartId(): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(CART_ID_STORAGE_KEY);
}

function emitCartIdChange() {
  if (!hasWindow()) return;
  window.dispatchEvent(new Event(CART_ID_CHANGE_EVENT));
}

export function writeStoredCartId(cartId: string | null) {
  if (!hasWindow()) return;

  const current = readStoredCartId();
  if (cartId === current) return;

  if (cartId) {
    window.localStorage.setItem(CART_ID_STORAGE_KEY, cartId);
  } else {
    window.localStorage.removeItem(CART_ID_STORAGE_KEY);
  }

  emitCartIdChange();
}

function getSnapshot(): string | null {
  return readStoredCartId();
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribe(callback: () => void): () => void {
  if (!hasWindow()) {
    return () => {
    };
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_ID_STORAGE_KEY) {
      callback();
    }
  };

  const onCartIdChange = () => {
    callback();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_ID_CHANGE_EVENT, onCartIdChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_ID_CHANGE_EVENT, onCartIdChange);
  };
}

async function createCartId(client: ApolloClient): Promise<string> {
  const {data} = await client.mutate<CartCreateMutation, CartCreateMutationVariables>({
    mutation: CartCreateDocument,
    variables: {input: {}},
  });

  const payload = data?.cartCreate;
  const userErrors = payload?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  const cartId = payload?.cart?.id;
  if (!cartId) {
    throw new Error("Cart creation succeeded but no cart id was returned");
  }

  return cartId;
}

let ensureCartPromise: Promise<void> | null = null;

export function useCartId(): string | null {
  const client = apolloStorefrontClient;
  const cartId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!hasWindow()) return;
    if (ensureCartPromise) return;

    ensureCartPromise = (async () => {
      let currentCartId = readStoredCartId();

      if (!currentCartId) {
        const newCartId = await createCartId(client);
        writeStoredCartId(newCartId);
        return;
      }

      const {data} = await client.query<CartGetQuery, CartGetQueryVariables>({
        query: CartGetDocument,
        variables: {cartId: currentCartId},
      });

      if (data?.cart?.id) {
        return;
      }

      writeStoredCartId(null);

      currentCartId = await createCartId(client);
      writeStoredCartId(currentCartId);
    })()
      .catch((error) => {
        console.error("Failed to ensure cart id", error);
      })
      .finally(() => {
        ensureCartPromise = null;
      });
  }, [client, cartId]);

  return cartId;
}