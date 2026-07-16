import React from "react";
import type {Metadata} from "next";
import {fiona, inter, noto_serif} from "@/app/fonts";
import "@/app/globals.css";
import {GoogleTagManager} from "@next/third-parties/google";
import {tagManagerId} from "@/lib/env";

export const metadata: Metadata = {
  title: "Forged & Found",
  description: "",
};

export default function RootLayout({children}: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${noto_serif.variable} ${fiona.variable}`}
    >
    <body className="flex flex-col min-h-screen w-full">
    {children}
    </body>
    <GoogleTagManager gtmId={tagManagerId}/>
    </html>
  );
}