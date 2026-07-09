"use client";
import React from "react";
import {Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle} from "@/components/ui/sheet";
import {useCartSheet} from "@/lib/cart/useCartSheet";
import {CartLinesContainer} from "@/components/cart/CartLinesContainer";
import {Separator} from "@/components/ui/separator";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {Spinner} from "@/components/ui/spinner";
import {Icon} from "@/components/ui/icon";
import {Price, Text} from "@/components/typography";
import {useCart} from "@/lib/cart/useCart";
import {useCartPrice} from "@/lib/cart/useCartPrice";

export default function CartSheet() {
  const {open, setOpen} = useCartSheet();
  const {data, loading, error} = useCart();
  const {total} = useCartPrice(data?.cart?.cost);
  const checkoutUrl = data?.cart?.checkoutUrl ?? "/shop/checkout/cart";
  if (error) return (
    <div className="flex h-screen w-screen items-center justify-center">
      <p className="text-xl">Sorry, an error occurred whilst loading you shopping cart content.</p>
      <p className="text-lg">Please refresh your browser. If continued please try again later</p>
    </div>);

  return (
    <Sheet open={open} aria-describedby="shopping-cart" onOpenChange={setOpen}>
      <SheetDescription aria-describedby="shopping-cart"/>
      <SheetContent side="right">
        <SheetHeader className="h-14">
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>

        <CartLinesContainer fragment={data?.cart ?? null}/>

        <SheetFooter className="sticky bottom-0">
          <Separator/>
          <div className="flex flex-col gap-y-6 pb-4">
            <section className="flex-col py-2">
              <div className="flex items-end justify-between">
                <Text variant="title" className="text-sm font-semibold tracking-wide">Total:</Text>
                <Price price={total}/>
              </div>
            </section>
            {/*// TODO: the loading requires to be notified from mutations. useQuery is not getting updated until mutation is completed*/}
            <Button asChild onClick={() => setOpen(false)}>
              <Link href={checkoutUrl ?? "/shop/checkout/cart"}>
                checkout
                {loading ? (<Spinner/>) : (<Icon icon="arrow-right"/>)}
              </Link>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
