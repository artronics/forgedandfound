import React from "react";
import {SearchResults} from "@/components/search/SearchResults";

export default async function SearchPage(
  {
    searchParams,
  }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }) {
  const q = (await searchParams)["q"] ?? "";
  const query = Array.isArray(q) ? q[0] ?? "" : q;
  return <SearchResults query={query}/>;
}
