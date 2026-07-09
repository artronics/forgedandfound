"use client";
import React from "react";
import {Content} from "@/components/Content";
import {usePrivacyPolicy} from "@/lib/content/useLegal";


export default function PrivacyPolicyPage() {
  const {data, loading} = usePrivacyPolicy();

  return (
    <Content
      className="[&>p]:first:text-muted-foreground [&>p]:first:uppercase"
      title={data?.shop.privacyPolicy?.title ?? "Privacy Policy"}
      html={data?.shop.privacyPolicy?.body ?? ""}
      loading={loading}
    />
  );
}
