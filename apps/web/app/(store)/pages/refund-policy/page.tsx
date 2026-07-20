import React from "react";
import {Content} from "@/components/Content";
import {getPolicy} from "@/lib/shopify/server";

export default async function RefundPolicyPage() {
  const policy = await getPolicy("refundPolicy");

  return (
    <Content
      title={policy?.title ?? "Refund Policy"}
      html={policy?.body ?? ""}
    />
  );
}
