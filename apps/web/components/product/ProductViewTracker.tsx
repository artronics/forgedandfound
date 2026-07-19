"use client";

import {useEffect, useRef} from "react";
import {pushEvent} from "@/lib/analytics";

/**
 * Fires the product-view analytics event once per product on the client.
 * The product itself is fetched and rendered on the server.
 */
export function ProductViewTracker({product}: { product: { id: string } }) {
  const pushedId = useRef<string | null>(null);

  useEffect(() => {
    if (pushedId.current === product.id) return;
    pushedId.current = product.id;
    pushEvent(product);
  }, [product]);

  return null;
}
