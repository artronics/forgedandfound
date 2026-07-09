"use client";

import {useFavourites} from "@/lib/favourites/useFavourites";
import {useSession} from "next-auth/react";
import {useFavouriteProducts} from "@/lib/favourites/useFavouriteProducts";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {ProductItemCard} from "@/components/product/ProductItemCard";
import React from "react";
import {GalleryGrid} from "@/components/ui/gallery";
import {GetWishlistProductsQuery} from "@/graphql/generated/graphql";
import {signInWithCognito} from "@/actions/auth-actions";

type FavouriteProduct = Extract<
  GetWishlistProductsQuery["nodes"][number],
  { __typename: "Product" }
>;

// TODO: handle pagination. Right now we show all nodes
// TODO: handle loading
export default function FavouritesPage() {
  const {ids, loading} = useFavourites();
  const {status} = useSession();
  const {data, loading: loadingProducts, error} = useFavouriteProducts({ids});
  const products = (data?.nodes ?? [])
    .filter((node): node is FavouriteProduct => node?.__typename === "Product");

  const signIn = () => (
    <form className="inline" action={signInWithCognito}>
      <button type="submit" className="cursor-pointer underline underline-offset-4">
        sign in or register
      </button>
    </form>
  );

  return (
    <Page>
      <PageHeader>
        <h2>Wishlist</h2>
      </PageHeader>
      <PageContent>
        {status === "unauthenticated" && (
          <div className="w-full bg-secondary text-center py-4">
            <div className="text-secondary-foreground">Please {signIn()} to sync your favourites across devices.</div>
          </div>
        )}
        <GalleryGrid>
          {products?.map(p => {
            return (<ProductItemCard key={p.id} fragment={p}/>);
          })}
        </GalleryGrid>
      </PageContent>
    </Page>
  );
}

