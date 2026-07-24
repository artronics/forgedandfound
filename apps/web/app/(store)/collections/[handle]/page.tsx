import React from "react";
import {Collection} from "@/components/collection/Collection";
import {getFacetVocab} from "@/lib/shopify/server";
import {parseFilterParams} from "@/lib/catalog/facets";

// Server component so filter links (?design=pendant&style=dainty — the
// spec/menu.yaml convention) resolve on first load: handles -> metaobject GIDs
// via the facet vocabulary. After that the client updates the URL itself
// (history.replaceState) without another server pass.

type CollectionPageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionPage({params, searchParams}: CollectionPageProps) {
  const {handle} = await params;
  const vocab = await getFacetVocab();
  const initialFilters = parseFilterParams(await searchParams, vocab);
  return (
    <Collection handle={handle} vocab={vocab} initialFilters={initialFilters}/>
  );
}
