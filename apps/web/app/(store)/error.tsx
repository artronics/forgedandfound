"use client";

import {useEffect} from "react";
import {ErrorState} from "@/components/feedback";
import {browserLogger} from "@forgedandfound/logger/browser";

export default function StoreError({error, reset}: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    browserLogger.error({err: error}, "store page failed to render");
  }, [error]);

  return <ErrorState onRetry={reset}/>;
}
