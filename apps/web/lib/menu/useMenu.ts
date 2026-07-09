"use client";
import {useEffect, useState} from "react";
import {apolloStorefrontClient} from "@/lib/shopify/client/storefront-client";
import {GetMenuDocument, GetMenuQuery, GetMenuQueryVariables} from "@/graphql/generated/graphql";

export type MenuImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
} | null;

export interface MenuItem {
  label: string;
  href: string;
  image: MenuImage[] | null;
}

export interface FilterGroup {
  label: string;
  items: MenuItem[];
}

export interface Menu {
  label: string;
  href: string;
  groups: FilterGroup[];
  image: MenuImage;
}

type MainItemResource = NonNullable<GetMenuQuery["menu"]>["main"][number]["resource"];
type FilterItemResource = NonNullable<GetMenuQuery["menu"]>["main"][number]["filters"][number]["items"][number]["resource"];

type CollectionFilterResource = Extract<FilterItemResource, { __typename: "Collection" }>;
type MetaobjectNode = Extract<
  NonNullable<NonNullable<CollectionFilterResource["metafield"]>["references"]>["edges"][number]["node"],
  { __typename: "Metaobject" }
>;
type MediaImageNode = Extract<
  NonNullable<MetaobjectNode["fields"][number]["references"]>["edges"][number]["node"],
  { __typename: "MediaImage" }
>;

function toRelativeUrl(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const u = new URL(decoded);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

function extractStyleHandle(url: string): string | null {
  // URLs are encoded, e.g. /collections/rings/%3Ftag=chunky&style=ring_chunky
  const decoded = decodeURIComponent(url);
  const queryIndex = decoded.indexOf("?");
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(decoded.slice(queryIndex + 1));
  return params.get("style");
}

function extractItemImage(resource: FilterItemResource, url: string): MenuImage[] | null {
  if (resource?.__typename !== "Collection") return null;

  const styleHandle = extractStyleHandle(url);

  const metaobjects = (resource.metafield?.references?.edges ?? [])
    .map(edge => edge.node)
    .filter((node): node is MetaobjectNode => node.__typename === "Metaobject");

  const matchedMetaobject = styleHandle
    ? metaobjects.find(m => m.handle === styleHandle) ?? null
    : null;

  const targets = matchedMetaobject ? [matchedMetaobject] : metaobjects;

  const images = [];
  for (const metaobject of targets) {
    for (const field of metaobject.fields) {
      const mediaImages = (field.references?.edges ?? [])
        .map(edge => edge.node)
        .filter((node): node is MediaImageNode => node.__typename === "MediaImage");

      for (const mediaImage of mediaImages) {
        if (mediaImage.image) {
          images.push({
            url: mediaImage.image.url,
            altText: mediaImage.image.altText,
            width: mediaImage.image.width,
            height: mediaImage.image.height,
          });
        }
      }
    }
  }

  return images.length > 0 ? images : null;
}

function buildMenu(data?: GetMenuQuery): Menu[] {
  return data?.menu?.main.map((mainItem) => {
    const col = mainItem.resource as Extract<MainItemResource, { __typename: "Collection" }>;

    const groups: FilterGroup[] = mainItem.filters.map(filter => ({
      label: filter.title,
      items: filter.items.map(item => ({
        label: item.title,
        href: toRelativeUrl(item.url ?? ""),
        image: extractItemImage(item.resource, item.url ?? ""),
      })),
    }));

    return {
      label: mainItem.title,
      href: toRelativeUrl(mainItem.url ?? ""),
      groups,
      image: col?.image ?? null,
    };
  }) ?? [];
}

async function fetchMenu(): Promise<GetMenuQuery | undefined> {
  const {data} = await apolloStorefrontClient.query<GetMenuQuery, GetMenuQueryVariables>(
    {query: GetMenuDocument},
  );
  return data;
}

export function useMenu(): { menu: Menu[]; loading: boolean } {
  const [menu, setMenu] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenu().then(data => {
      setMenu(buildMenu(data));
      setLoading(false);
    });
  }, []);

  return {menu, loading};
}
