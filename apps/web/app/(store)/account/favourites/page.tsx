"use client";

import {useFavourites} from "@/lib/favourites/useFavourites";
import {useSession} from "next-auth/react";
import {skipToken, useQuery} from "@apollo/client/react";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import React from "react";
import {GalleryGrid} from "@/components/ui/gallery";
import {GetWishlistProductsDocument, GetWishlistProductsQuery} from "@/graphql/generated/graphql";
import {useLoginSheet} from "@/lib/auth/useLoginSheet";
import {QueryGate} from "@/components/feedback";

type FavouriteProduct = Extract<
  GetWishlistProductsQuery["nodes"][number],
  { __typename: "Product" }
>;

// TODO: handle pagination. Right now we show all nodes
export default function FavouritesPage() {
  const {ids, loading} = useFavourites();
  const {status} = useSession();
  const {data, loading: loadingProducts, error, refetch} = useQuery(
    GetWishlistProductsDocument,
    ids.length > 0 ? {variables: {ids}} : skipToken,
  );
  const products = (data?.nodes ?? [])
    .filter((node): node is FavouriteProduct => node?.__typename === "Product");

  const {setOpen} = useLoginSheet();
  const signIn = () => (
    <button onClick={() => setOpen(true)} className="cursor-pointer underline underline-offset-4">
      sign in or register
    </button>
  );

  return (
    <QueryGate loading={loading || (loadingProducts && !data)} error={error} onRetry={() => refetch()}>
      <Page>
        <PageHeader>
          <h2>Wishlist</h2>
        </PageHeader>
        <PageContent>
          {status === "unauthenticated" && (
            <div className="w-full bg-secondary text-center py-4">
              <div className="text-secondary-foreground">Please {signIn()} to sync your favourites across
                devices.
              </div>
            </div>
          )}
          <GalleryGrid>
            {products?.map(p => {
              return (<ProductItemCard key={p.id} fragment={p}/>);
            })}
          </GalleryGrid>
        </PageContent>
      </Page>
    </QueryGate>
  );
}
