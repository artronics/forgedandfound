"use client";

import React from "react";
import {Collection} from "@/components/collection/Collection";
import {useSegment} from "@/lib/route/useSegment";

export default function CollectionPage() {
  const handle = useSegment("handle");
  return (
    <Collection handle={handle ?? "all-products"}/>
  );
}
