"use client";

import {useEffect, useState} from "react";
import Image from "next/image";
import type {MenuImage} from "@/lib/menu/useMenu";

type NonNullMenuImage = NonNullable<MenuImage>;

interface CyclingImageProps {
  images: NonNullMenuImage[];
  className?: string;
}

export function CyclingImage({images, className}: CyclingImageProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex(i => (i + 1) % images.length), 2000);
    return () => clearInterval(id);
  }, [images]);

  const img = images[index];
  if (!img) return null;

  return (
    <Image
      src={img.url}
      alt={img.altText ?? ""}
      width={img.width ?? 400}
      height={img.height ?? 400}
      className={className}
    />
  );
}
