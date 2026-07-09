"use client";

import {useParams} from "next/navigation";

export function useSegment(seg: string) {
  const params = useParams();
  return Array.isArray(params[seg]) ? params[seg][0] : params[seg];
}