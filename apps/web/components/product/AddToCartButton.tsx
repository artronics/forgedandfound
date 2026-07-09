import {useAddToCart} from "@/lib/cart/useAddToCart";
import {useCartSheet} from "@/lib/cart/useCartSheet";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import React from "react";
import {AddWishListButton} from "@/components/wishlist/AddWishListButton";

export function AddToCartButton({variantId, productId, onClick, className}: {
  variantId: string | null;
  productId?: string;
  onClick?: () => void,
  className?: string
}) {
  const {addToCart, loading, error} = useAddToCart();
  const {setOpen} = useCartSheet();
  const onAddToCart = async () => {
    onClick?.();
    if (variantId === null) return;
    await addToCart(variantId);
    setOpen(true);
  };
  const disabled = loading || variantId === null;
  if (error) {
    return <Button disabled={true} size="lg" className="mt-4 w-full">Error adding to cart</Button>;
  }
  return (
    <div className="flex w-full items-center gap-1">
      <Button className={cn("flex-1", className)} disabled={disabled} onClick={onAddToCart}>Add To Cart</Button>
      <AddWishListButton productId={productId}/>
    </div>
  );
}

