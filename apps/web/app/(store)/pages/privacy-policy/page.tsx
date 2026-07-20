import React from "react";
import {Content} from "@/components/Content";
import {getPolicy} from "@/lib/shopify/server";

export default async function PrivacyPolicyPage() {
  const policy = await getPolicy("privacyPolicy");

  return (
    <Content
      className="[&>p]:first:text-muted-foreground [&>p]:first:uppercase"
      title={policy?.title ?? "Privacy Policy"}
      html={policy?.body ?? ""}
    />
  );
}
