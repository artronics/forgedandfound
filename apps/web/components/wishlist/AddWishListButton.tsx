"use client";

import {useFavourites} from "@/lib/favourites/useFavourites";
import {HeartToggle} from "@/components/wishlist/HeartToggle";

type Props = {
  productId?: string;
  className?: string;
};

export function AddWishListButton({productId, className}: Props) {
  const {isFavourited, toggle, loading} = useFavourites();
  const disabled = loading || !productId;
  const isFaved = !productId ? false : isFavourited(productId);

  const status = disabled
    ? "Select a variant to add to wishlist"
    : isFavourited(productId)
      ? "Remove from favourites"
      : "Add to favourites";

  const onClick = () => {
    if (!disabled) {
      const _ = toggle(productId);
    }
  };

  return (
    <HeartToggle
      onClick={onClick}
      disabled={disabled}
      aria-label={status}
      suppressHydrationWarning
      data-state={isFaved ? "on" : "off"}
    />
  );
}
