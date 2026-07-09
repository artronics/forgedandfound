"use client";
import React from "react";
import {ApolloProvider} from "@/components/apollo-provider";
import {Navbar} from "@/components/navbar/navbar";
import {Footer} from "@/components/footer";
import {CartSheetProvider} from "@/lib/cart/useCartSheet";
import CartSheet from "@/components/cart/CartSheet";
import {SessionProvider} from "next-auth/react";
import {useCartBuyerIdentity} from "@/lib/cart/useCartBuyerIdentity";
import {BreakpointProvider} from "@/lib/layout/BreakpointProvider";
import {SearchSheetProvider} from "@/lib/search/useSearchSheet";
import {SearchSheet} from "@/components/search/SearchSheet";
import LoginSheet from "@/components/auth/LoginSheet";
import {LoginSheetProvider} from "@/lib/auth/useLoginSheet";

function CartBuyerIdentitySync() {
  useCartBuyerIdentity();
  return null;
}

export default function StoreLayout({children}: {
  children: React.ReactNode,
}) {
  return (
    <SessionProvider>
      <ApolloProvider>
        <BreakpointProvider>
          <LoginSheetProvider>
            <SearchSheetProvider>
              <CartSheetProvider>
                <CartBuyerIdentitySync/>
                <Navbar/>
                <div className="flex-1">
                  {children}
                </div>
                <Footer/>
                <CartSheet/>
                <SearchSheet/>
                <LoginSheet/>
              </CartSheetProvider>
            </SearchSheetProvider>
          </LoginSheetProvider>
        </BreakpointProvider>
      </ApolloProvider>
    </SessionProvider>
  );
}
