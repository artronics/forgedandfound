"use client";

import React, {useLayoutEffect, useRef, useState} from "react";

type SlideDeckProps = {
  /** Index of the currently visible panel. */
  index: number;
  /** One panel per child; the deck slides horizontally between them. */
  children: React.ReactNode[];
};

/**
 * Horizontal slide between a fixed set of panels. The container height animates
 * to match the active panel (measured, and kept in sync via ResizeObserver so
 * internal changes like validation errors or tab switches re-fit smoothly).
 */
export function SlideDeck({index, children}: SlideDeckProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const active = trackRef.current?.children[index] as HTMLElement | undefined;
    if (!active) return;

    const measure = () => setHeight(active.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(active);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      className="overflow-hidden transition-[height] duration-300 ease-out"
      style={{height}}
    >
      <div
        ref={trackRef}
        className="flex transition-transform duration-300 ease-out"
        style={{transform: `translateX(-${index * 100}%)`}}
      >
        {children.map((child, i) => (
          <div key={i} className="w-full shrink-0 self-start">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
