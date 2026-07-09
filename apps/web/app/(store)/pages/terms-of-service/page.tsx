"use client";
import React from "react";
import {Content} from "@/components/Content";
import {useTermsOfService} from "@/lib/content/useLegal";


export default function TermsOfConditionPage() {
  const {data, loading} = useTermsOfService();

  return (
    <Content
      title={data?.shop.termsOfService?.title ?? "Terms of Service"}
      html={data?.shop.termsOfService?.body ?? ""}
      loading={loading}
    />
  );
}
