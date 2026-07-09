"use client";
import React from "react";
import {Content} from "@/components/Content";
import {useRefundPolicy} from "@/lib/content/useLegal";


export default function RefundPolicyPage() {
  const {data, loading} = useRefundPolicy();

  return (
    <Content
      title={data?.shop.refundPolicy?.title ?? "Refund Policy"}
      html={data?.shop.refundPolicy?.body ?? ""}
      loading={loading}
    />
  );
}
