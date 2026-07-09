"use client";

import React from "react";
import {ApolloNextAppProvider} from "@apollo/client-integration-nextjs";
import {makeApolloStorefrontClient} from "@/lib/shopify/client/storefront-client";

export function ApolloProvider({children}: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeApolloStorefrontClient}>
      {children}
    </ApolloNextAppProvider>
  );
}