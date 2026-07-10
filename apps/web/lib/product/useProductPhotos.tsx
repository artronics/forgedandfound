"use client";

export interface ProductPhoto {
  id: string | null,
  thumbhash?: string | null,
  url: string,
  altText: string | null,
  width?: number | null,
  height?: number | null
}
