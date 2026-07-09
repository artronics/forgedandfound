"use client";
import {ApolloLink, HttpLink} from "@apollo/client";
import {shopify} from "@/lib/env";
import {ApolloClient, InMemoryCache} from "@apollo/client-integration-nextjs";
import {LocalState} from "@apollo/client/local-state";
import {relayStylePagination} from "@apollo/client/utilities";
import {getMaxQuantity} from "@/lib/cart/max-quantity";

const cache = new InMemoryCache({
  typePolicies: {
    Collection: {
      fields: {
        products: relayStylePagination(["filters", "sortKey", "reverse"]),
      },
    },
    CartLine: {
      fields: {
        maxQuantity: {
          read(_, {readField}) {
            const id = readField<string>("id");
            if (!id) return null;
            return getMaxQuantity(id);
          },
        },
      },
    },
  },
});

function _makeClient() {
  const httpLink = new HttpLink({
    uri: shopify.graphqlUrl,
    headers: {
      "X-Shopify-Storefront-Access-Token": shopify.publicToken,
    },
    fetch,
  });

  return new ApolloClient({
    link: ApolloLink.from([httpLink]),
    cache,
    localState: new LocalState(),
  });
}

export const apolloStorefrontClient = _makeClient();
export const makeApolloStorefrontClient = () => apolloStorefrontClient;
