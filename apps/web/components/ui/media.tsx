import React from "react";
import {cn, getThumbImage} from "@/lib/utils";
import Image from "next/image";
import {ProductPhoto} from "@/lib/product/product-photo";
import Link from "next/link";

type FrameProps = {
  image: ProductPhoto | null,
  href?: string,
  children?: React.ReactNode,
  className?: string,
}

export function Frame(
  {image, children, href, className, ...props}: FrameProps & React.ComponentProps<"div">) {
  if (!image) return null;
  const altText = image.altText ?? "Product Image";
  const thumb = getThumbImage(image.thumbhash);

  if (image.width && image.height) {
    return (
      <div className="group/frame relative h-auto" {...props}>
        <Link href={href ?? "#"}>
          <Image
            blurDataURL={thumb}
            src={image.url}
            alt={altText}
            width={image.width}
            height={image.height}
            className={cn("w-full h-auto", className)}
          />
        </Link>
        {children}
      </div>
    );
  }

  return (
    <Image src={image.url} alt={altText} fill className={cn("object-cover", className)}/>
  );
}

