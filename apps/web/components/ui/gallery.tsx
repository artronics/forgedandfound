import React from "react";
import {cn} from "@/lib/utils";
import {Frame} from "@/components/ui/media";
import {ProductPhoto} from "@/lib/product/useProductPhotos";
import {Album, InlineAlbum} from "@/components/ui/album";
import {IconButton} from "@/components/ui/icon";

function FullscreenButton({onClick}: { onClick: () => void }) {
  return (
    <IconButton
      icon="expand"
      weight="thin"
      iconClassName="size-6"
      onClick={onClick}
      variant="outline"
      className={cn(
        "absolute bottom-4 right-4 backdrop-blur-sm rounded-sm border-none size-12 opacity-0",
        "group-hover/frame:opacity-40 transition-all duration-500",
        "pointer-coarse:hidden",
      )}
    />
  );
}

export function Gallery({images}: { images: ProductPhoto[] }) {
  const [open, setOpen] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const onOpen = (i: number) => {
    setCurrentIndex(i);
    setOpen(true);
  };

  return (
    <div>
      {/* Mobile: swipeable inline album — tap to open fullscreen */}
      <div className="md:hidden">
        <InlineAlbum images={images} onOpen={onOpen}/>
      </div>

      {/* Desktop: image grid with hover fullscreen button */}
      <div className="hidden md:grid grid-cols-2 [&>*:first-child]:col-span-2 w-full gap-0.5">
        {images.map((image, i) => (
          <Frame key={image.id ?? i} image={image} onClick={() => onOpen(i)}>
            <FullscreenButton onClick={() => onOpen(i)}/>
          </Frame>
        ))}
      </div>

      <Album open={open} setOpen={setOpen} selectedIndex={currentIndex} images={images}/>
    </div>
  );
}

export function GalleryGrid(
  {
    className,
    ...props
  }: React.ComponentProps<"div">,
) {
  return (
    <div
      data-slot="gallery"
      className={cn("grid gap-4",
        "   grid-cols-1",
        "md:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4",
        className)}
      {...props}
    />
  );
}

