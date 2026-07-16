"use client";

import React from "react";
import {Collection} from "@/components/collection/Collection";
import {useSegment} from "@/lib/route/useSegment";
import {browserLogger} from "@forgedandfound/logger/browser";

export default function CollectionPage() {
  const handle = useSegment("handle");
  browserLogger.warn({handle}, "my handle");
  return (
    <Collection handle={handle ?? "all-products"}/>
  );
}
