import React from "react";
import {sanitizeHtml} from "@/lib/utils";

type ProductDescriptionProps = {
  html: string;
};

export function DescriptionHtml({html, className}: ProductDescriptionProps & { className?: string }) {
  return (
    <div
      className={`
      ${className}
    font-sans text-sm font-light leading-relaxed text-muted-foreground
    [&_p]:my-2
    [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5
    [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5
    [&_li]:my-1
    [&_strong]:font-semibold [&_strong]:text-base-content
    [&_em]:italic
    [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-base-content
    [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-base-content
    [&_br]:block [&_br]:content-[''] [&_br]:my-2
  `}
      dangerouslySetInnerHTML={{__html: sanitizeHtml(html)}}
    />
  );
}
