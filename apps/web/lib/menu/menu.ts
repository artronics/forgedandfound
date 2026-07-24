import {GetMenuQuery} from "@/graphql/generated/graphql";

// The nav domain: a straight read of the seeded menu (model/shopify/spec/
// menu.yaml). Top-level items are the nav entries; their children are the
// mega-menu columns ("By Design", "By Style", …); grandchildren are the links.
// Filter links arrive as ordinary urls carrying ?facet=handle params — the
// collection page interprets those (lib/catalog), not the menu.

export interface MenuLink {
  label: string;
  href: string;
}

export interface MenuGroup {
  label: string;
  items: MenuLink[];
}

export interface Menu {
  label: string;
  href: string;
  groups: MenuGroup[];
}

/** Shopify returns absolute urls on its own domain; the storefront wants the
 * path. Heading items point at `#` (the nav-editor convention) — preserved, so
 * the UI can render them as text rather than links. */
function toRelativeUrl(url: string): string {
  if (url.endsWith("#")) return "#";
  try {
    const u = new URL(decodeURIComponent(url));
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export function buildMenu(data?: GetMenuQuery): Menu[] {
  return (
    data?.menu?.items.map((item) => {
      const children = item.items ?? [];

      // Level-2 items with children are columns; level-2 items that are
      // direct links (Shop by Metal -> Gold Vermeil) gather into one
      // unlabelled column so they still render.
      const links = children
        .filter((child) => child.items.length === 0)
        .map((link) => ({label: link.title, href: toRelativeUrl(link.url ?? "#")}));

      const groups = children
        .filter((child) => child.items.length > 0)
        .map((group) => ({
          label: group.title,
          items: group.items.map((link) => ({
            label: link.title,
            href: toRelativeUrl(link.url ?? "#"),
          })),
        }));

      return {
        label: item.title,
        href: toRelativeUrl(item.url ?? "#"),
        groups: links.length ? [{label: "", items: links}, ...groups] : groups,
      };
    }) ?? []
  );
}
