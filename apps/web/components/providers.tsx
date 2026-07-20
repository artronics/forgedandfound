"use client";
import React from "react";
import {SessionProvider} from "next-auth/react";
import {ApolloProvider} from "@/components/apollo-provider";
import {BreakpointProvider} from "@/lib/layout/BreakpointProvider";
import {LoginSheetProvider} from "@/lib/auth/useLoginSheet";
import {SearchSheetProvider} from "@/lib/search/useSearchSheet";
import {CartSheetProvider} from "@/lib/cart/useCartSheet";
import {useCartBuyerIdentity} from "@/lib/cart/useCartBuyerIdentity";

function CartBuyerIdentitySync() {
  useCartBuyerIdentity();
  return null;
}

export function StoreProviders({children}: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ApolloProvider>
        <BreakpointProvider>
          <LoginSheetProvider>
            <SearchSheetProvider>
              <CartSheetProvider>
                <CartBuyerIdentitySync/>
                {children}
              </CartSheetProvider>
            </SearchSheetProvider>
          </LoginSheetProvider>
        </BreakpointProvider>
      </ApolloProvider>
    </SessionProvider>
  );
}
