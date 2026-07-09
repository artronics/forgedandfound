"use client";
import React from "react";
import {Content} from "@/components/Content";
import {useShippingPolicy} from "@/lib/content/useLegal";


export default function ShippingPolicyPage() {
  const {data, loading} = useShippingPolicy();

  return (
    <Content
      title={data?.shop.shippingPolicy?.title ?? "Shipping Policy"}
      html={data?.shop.shippingPolicy?.body ?? ""}
      loading={loading}
    />
  );
}
