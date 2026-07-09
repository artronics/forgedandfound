import {skipToken, useQuery} from "@apollo/client/react";
import {CartGetTotalQuantityDocument} from "@/graphql/generated/graphql";
import {useCartId} from "@/lib/cart/useCartId.store";
import React from "react";
import {SearchButton} from "@/components/search/SearchButton";
import {CartButton} from "@/components/cart/CartButton";
import {WishlistButton} from "@/components/wishlist/WishlistButton";
import {UserButton} from "@/components/customer/UserButton";


export function NavActions() {
  const cartId = useCartId();
  const {data} = useQuery(
    CartGetTotalQuantityDocument,
    cartId ? {
      variables: {cartId},
    } : skipToken,
  );
  const cartCount = data?.cart?.totalQuantity ?? 0;
  return (
    <div className="flex flex-row-reverse items-center gap-1 md:gap-2">
      <CartButton cartCount={cartCount}/>
      <WishlistButton/>
      <UserButton/>
      <SearchButton/>
    </div>
  );
}
