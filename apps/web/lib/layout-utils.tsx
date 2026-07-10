"use client";
import React, {useEffect, useState} from "react";
import {cn} from "@/lib/utils";

const LIGHT_COLORS = [
  "#fde2e4", "#fad2cf", "#fae1dd", "#f8edeb", "#ece4db",
  "#d8e2dc", "#ffe5d9", "#ffd7ba", "#fec89a", "#e8e8e4",
  "#d4e09b", "#cbdfbd", "#f6f4d2", "#dfe7fd", "#cddafd",
  "#bee1e6", "#caf0f8", "#ddd8c4", "#e3d5ca", "#f5cac3",
  "#e8d1c5", "#eddcd2", "#fff1e6", "#f0efeb", "#eae4e9",
  "#c6def1", "#c9e4de", "#faedcd", "#dbcdf0", "#f2c6de",
];

function randomColor() {
  return LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)];
}

export function FlexBox({children, className, index}: {
  className?: string;
  index?: number;
  children?: React.ReactNode;
}) {
  const [colors, setColors] = useState<{ bg: string; border: string } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setColors({bg: randomColor(), border: randomColor()});
    });
  }, []);

  return (
    <div
      className={cn("uppercase", className)}
      style={colors ? {backgroundColor: colors.bg, border: `1px solid ${colors.border}`} : undefined}
    >
      {children ? children : index}
    </div>
  );
}

export function FlexBoxGroup({children, className}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) => {
        if (React.isValidElement<{ index?: number }>(child) && child.type === FlexBox) {
          return React.cloneElement(child, {index: i});
        }
        return child;
      })}
    </div>
  );
}