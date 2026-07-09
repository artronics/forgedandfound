import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Icon, IconButton} from "@/components/ui/icon";
import {ProductPhoto} from "@/lib/product/useProductPhotos";
import {cn} from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlbumProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  images: ProductPhoto[];
  selectedIndex?: number;
};

type InlineAlbumProps = {
  images: ProductPhoto[];
  selectedIndex?: number;
  onOpen?: (index: number) => void;
};

// ─── Hook: drag-to-close ──────────────────────────────────────────────────────

function useDragToClose(onClose: () => void) {
  const [dragY, setDragY] = React.useState(0);
  const [isSnappingBack, setIsSnappingBack] = React.useState(false);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const primaryDirection = React.useRef<"h" | "v" | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {x: e.touches[0].clientX, y: e.touches[0].clientY};
    primaryDirection.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStart.current.x);
    const dy = e.touches[0].clientY - touchStart.current.y;
    const absDy = Math.abs(dy);

    if (!primaryDirection.current && (dx > 6 || absDy > 6)) {
      primaryDirection.current = absDy > dx ? "v" : "h";
    }
    if (primaryDirection.current === "v") setDragY(dy);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const absDy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);

    if (primaryDirection.current === "v" && absDy > 72) {
      setDragY(0);
      onClose();
    } else {
      setIsSnappingBack(true);
      setDragY(0);
    }

    touchStart.current = null;
    primaryDirection.current = null;
  };

  const dragProgress = Math.min(1, Math.abs(dragY) / 280);

  return {
    dragStyle: {
      transform: `translateY(${dragY * 0.45}px) scale(${1 - dragProgress * 0.12})`,
      opacity: 1 - dragProgress * 0.38,
      transition: isSnappingBack
        ? "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease"
        : undefined,
    },
    onTransitionEnd: () => setIsSnappingBack(false),
    touchHandlers: {onTouchStart, onTouchMove, onTouchEnd},
  };
}

// ─── Dot selector (mobile inline) ─────────────────────────────────────────────

function DotSelector({count, index, onSelect, className}: {
  count: number;
  index: number;
  onSelect?: (i: number) => void;
  className?: string;
}) {
  return (
    <div className={cn(
      "absolute bottom-3 left-1/2 -translate-x-1/2",
      "flex items-center gap-1.5 bg-muted/40 px-3 py-2 rounded-full",
      className,
    )}>
      {Array.from({length: count}).map((_, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(i);
          }}
          aria-label={`Go to image ${i + 1}`}
          className={cn(
            "rounded-full bg-primary/50 transition-all duration-200",
            index === i ? "size-2.5 bg-primary" : "size-2 opacity-60",
          )}
        />
      ))}
    </div>
  );
}

// ─── Scroll buttons (fullscreen desktop) ──────────────────────────────────────

function ScrollButton({dir, onClick, disabled}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous image" : "Next image"}
      variant="ghost"
      className={cn(
        "max-md:hidden",
        "text-muted-foreground/60 hover:text-muted-foreground/90 rounded-full bg-accent/60",
        "absolute top-1/2 -translate-y-1/2 z-10",
        dir === "left" ? "left-6 md:left-16" : "right-6 md:right-16",
        "flex items-center justify-center aspect-square h-full",
        "transition-opacity duration-300",
        disabled ? "opacity-0 pointer-events-none" : "hover:opacity-80",
      )}
    >
      {dir === "left"
        ? <Icon icon="chevron-left" strokeWidth={4} className="size-8"/>
        : <Icon icon="chevron-right" strokeWidth={4} className="size-8"/>}
    </Button>
  );
}

// ─── InlineAlbum ──────────────────────────────────────────────────────────────

export function InlineAlbum({images, selectedIndex = 0, onOpen}: InlineAlbumProps) {
  const [ref, api] = useEmblaCarousel({align: "center", startIndex: selectedIndex, dragFree: false});
  const [current, setCurrent] = React.useState(selectedIndex);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <div className="relative w-full aspect-square overflow-hidden">
      <div ref={ref} className="h-full overflow-hidden">
        <div className="flex h-full">
          {images.map((image, i) => (
            <div
              key={image.id ?? i}
              className="relative min-w-0 shrink-0 grow-0 basis-full h-full cursor-pointer"
              onClick={() => onOpen?.(current)}
            >
              <Image
                src={image.url}
                alt={image.altText ?? "Product Image"}
                fill
                className="object-cover"
                priority={i === selectedIndex}
                sizes="100vw"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      <DotSelector
        count={images.length}
        index={current}
        onSelect={(i) => api?.scrollTo(i)}
      />
    </div>
  );
}

// ─── Album (fullscreen dialog) ────────────────────────────────────────────────

export function Album({open, setOpen, images, selectedIndex = 0}: AlbumProps) {
  const [mainRef, mainApi] = useEmblaCarousel({
    align: "center",
    startIndex: selectedIndex,
    dragFree: false,
  });
  const [thumbRef, thumbApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: true,
    startIndex: selectedIndex,
  });

  const [current, setCurrent] = React.useState(selectedIndex);
  const {dragStyle, onTransitionEnd, touchHandlers} = useDragToClose(() => setOpen(false));

  React.useEffect(() => {
    if (!open) return;
    mainApi?.scrollTo(selectedIndex, true);
    thumbApi?.scrollTo(selectedIndex, true);
    setCurrent(selectedIndex);
  }, [open, selectedIndex, mainApi, thumbApi]);

  React.useEffect(() => {
    if (!mainApi) return;
    const onSelect = () => {
      const i = mainApi.selectedScrollSnap();
      setCurrent(i);
      thumbApi?.scrollTo(i);
    };
    mainApi.on("select", onSelect);
    return () => {
      mainApi.off("select", onSelect);
    };
  }, [mainApi, thumbApi]);

  const scrollToSlide = (i: number) => {
    setCurrent(i);
    mainApi?.scrollTo(i);
    thumbApi?.scrollTo(i);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        aria-describedby="product-album"
        className="flex flex-col h-dvh w-screen max-w-none sm:max-w-none inset-0 top-0 left-0 translate-x-0 translate-y-0 rounded-none p-0 gap-0 bg-background"
      >
        <DialogDescription/>
        <DialogTitle/>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-end px-6 pt-5 pb-3 md:px-16 md:pt-7 md:pb-4">
          <IconButton
            icon="x"
            weight="thin"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <span className="sr-only">Close</span>
          </IconButton>
        </div>

        {/* Main carousel */}
        <div
          className="flex-1 min-h-0"
          style={dragStyle}
          onTransitionEnd={onTransitionEnd}
          {...touchHandlers}
        >
          <div ref={mainRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {images.map((image, i) => (
                <div
                  key={image.id ?? i}
                  className="relative min-w-0 shrink-0 grow-0 basis-full h-full px-6 md:px-16"
                >
                  <Image
                    src={image.url}
                    alt={image.altText ?? "Product Image"}
                    fill
                    className="object-contain"
                    priority={i === selectedIndex}
                    sizes="100vw"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thumbnail selector */}
        <div className="shrink-0 pt-6 pb-8 md:pt-8 md:pb-10">
          <div className="relative px-6 md:px-16">
            <ScrollButton
              dir="left"
              onClick={() => scrollToSlide(Math.max(0, current - 1))}
              disabled={current === 0}
            />
            <div ref={thumbRef} className="overflow-hidden">
              <div className="flex my-1 gap-3 md:gap-4">
                {images.map((image, i) => (
                  <button
                    key={image.id ?? i}
                    onClick={() => scrollToSlide(i)}
                    aria-label={`View image ${i + 1}`}
                    className={cn(
                      "size-14 md:size-18",
                      "relative shrink-0 overflow-hidden transition-all duration-400 ease-out",
                      "focus-visible:outline-none",
                      current === i
                        ? "scale-110 border md:border-2 opacity-90 border-primary"
                        : "opacity-65 hover:opacity-75 hover:scale-105",
                    )}
                  >
                    <Image
                      src={image.url}
                      alt={image.altText ?? ""}
                      fill
                      className="object-cover"
                      sizes="68px"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
            <ScrollButton
              dir="right"
              onClick={() => scrollToSlide(Math.min(images.length - 1, current + 1))}
              disabled={current === images.length - 1}
            />
          </div>

          <p
            className="text-center mt-5 text-[9px] tracking-[0.22em] uppercase text-muted-foreground/30 md:hidden select-none">
            Swipe to navigate · Swipe up to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
