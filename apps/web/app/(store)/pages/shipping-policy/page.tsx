import React from "react";
import {Content} from "@/components/Content";
import {getPolicy} from "@/lib/shopify/server";

export default async function ShippingPolicyPage() {
  const policy = await getPolicy("shippingPolicy");

  return (
    <Content
      title={policy?.title ?? "Shipping Policy"}
      html={policy?.body ?? ""}
    />
  );
}
