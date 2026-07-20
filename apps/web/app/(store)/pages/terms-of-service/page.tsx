import React from "react";
import {Content} from "@/components/Content";
import {getPolicy} from "@/lib/shopify/server";

export default async function TermsOfConditionPage() {
  const policy = await getPolicy("termsOfService");

  return (
    <Content
      title={policy?.title ?? "Terms of Service"}
      html={policy?.body ?? ""}
    />
  );
}
