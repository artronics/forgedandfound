"use client";

import React from "react";
import {Button} from "@/components/ui/button";
import {Item, ItemContent, ItemFooter, ItemImage} from "@/components/ui/item";
import Image from "next/image";
import {Surface} from "@/components/ui/surface";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {Icon} from "@/components/ui/icon";
import {Text} from "@/components/typography";

// TODO: do we need this?
export default function CartPage() {
  return (
    <Page className="">
      <PageHeader>
        <Text variant="title">Test Page</Text>
        <Text variant="label">This is a test page</Text>
      </PageHeader>
      <PageContent>
        <div className="flex-1">
          <CartItems/>
        </div>
        <div>
          <CartSummary/>
        </div>
      </PageContent>
    </Page>
  );
}

function CartItems() {
  return (
    <div className="flex flex-col w-full gap-12">
      <CartItem/>
      <CartItem/>
      <CartItem/>
    </div>
  );
}

function CartSummary() {
  return (
    <Surface>
      <h2 className="title-2xl pb-4 border-b border-border/20">Order summary</h2>
      <div className="flex flex-col gap-6">
        <div className="flex title-sm">
          <p>subtotal</p>
          <p className="grow text-right">£233.40</p>
        </div>
        <div className="flex title-sm">
          <p>shipping</p>
          <p className="grow text-right">complementary</p>
        </div>
        <h4 className="flex border-t border-b border-border/20 pt-6 pb-4">
          <span className="text-lg capitalize">total</span>
          <span className="grow text-2xl text-right">£233.40</span>
        </h4>
      </div>
      <Button variant="default" size="default">Proceed to checkout</Button>
      <div className="flex flex-col items-center ">
        <p className="uppercase text-sm lg:text-base text-muted-foreground">Available payment methods</p>
        <div className="flex flex-row items-end h-6 gap-3 mt-4 text-foreground/40">
          <Icon icon="credit-card" size="sm"/>
          <Icon icon="paypal" size="sm" className="ml-1.5"/>
          <Icon icon="apple" size="sm" className="mb-0.5"/>
        </div>
      </div>
      {/*  badges*/}
    </Surface>
  );
}

function CartItem() {
  const QuantityStepper = () => {
    return (
      <div className="inline-flex h-10.5 w-30 items-center ghost-border">
        <Button variant="ghost" aria-label="Decrease quantity" className="w-10">-</Button>
        <div className="flex flex-1 py-1 ghost-border-x justify-center items-center">
          <span className="text-primary">1</span>
        </div>
        <Button variant="ghost" aria-label="Increase quantity" className="w-10">+</Button>
      </div>
    );
  };
  const Footer = () => {
    return (
      <>
        <QuantityStepper/>
        <div className="grow text-right">
          <Button variant="link" className="p-0">Save For Later</Button>
        </div>
      </>
    );
  };
  return (
    <Item>
      <ItemImage>
        <div className="bg-primary relative h-full w-full">
          <Image fill alt="image"
                 src="https://cdn.shopify.com/s/files/1/0973/5549/7778/files/24806553-2023-mv-q1brand-w-campaign-rgb-cropped-23a-rp_da47b66f-57c3-4eec-8c4c-05cb5ee77a88.webp?v=1776098761"/>
        </div>
      </ItemImage>
      <ItemContent className="relative">
        <Icon icon="x" className="absolute right-0 top-8 md:top-0"/>
        <h3 className="title-3xl">the solstice band</h3>
        <p className="title-sm">18ct rose gold vermeil</p>
        <h2 className="title-xl mb-5">43623.00</h2>
      </ItemContent>
      <ItemFooter>
        <Footer/>
      </ItemFooter>
    </Item>
  );
}
