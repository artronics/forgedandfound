"use client";

import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from "react";
import {type Breakpoint, BREAKPOINTS} from "./breakpoints";

type BreakpointContextType = {
  breakpoint: Breakpoint;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2Xl: boolean;

  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

const BreakpointContext = createContext<BreakpointContextType | null>(null);

function getBreakpoint(): Breakpoint {
  if (window.matchMedia(`(min-width: ${BREAKPOINTS["2xl"]}px)`).matches)
    return "2xl";

  if (window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`).matches)
    return "xl";

  if (window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`).matches)
    return "lg";

  if (window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`).matches)
    return "md";

  return "sm";
}

export function BreakpointProvider({
                                     children,
                                   }: {
  children: ReactNode;
}) {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("sm");

  useEffect(() => {
    const update = () => {
      setBreakpoint(getBreakpoint());
    };

    update();

    const mediaQueries = Object.values(BREAKPOINTS).map((width) => {
      const mq = window.matchMedia(`(min-width: ${width}px)`);
      mq.addEventListener("change", update);
      return mq;
    });

    return () => {
      mediaQueries.forEach((mq) => {
        mq.removeEventListener("change", update);
      });
    };
  }, []);

  const value = useMemo(
    () => ({
      breakpoint,

      isSm: breakpoint === "sm",
      isMd: breakpoint === "md",
      isLg: breakpoint === "lg",
      isXl: breakpoint === "xl",
      is2Xl: breakpoint === "2xl",

      isMobile: breakpoint === "sm",
      isTablet: breakpoint === "md",
      isDesktop: ["lg", "xl", "2xl"].includes(breakpoint),
    }),
    [breakpoint],
  );

  return (
    <BreakpointContext.Provider value={value}>
      {children}
    </BreakpointContext.Provider>
  );
}

export function useBreakpoint() {
  const context = useContext(BreakpointContext);

  if (!context) {
    throw new Error(
      "useBreakpoint must be used within a BreakpointProvider",
    );
  }

  return context;
}