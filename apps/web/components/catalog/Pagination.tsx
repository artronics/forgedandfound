"use client";

import React from "react";
import {Button} from "@/components/ui/button";

// Load-more pagination shared by the collection and search surfaces.

type PaginationProps = {
  loading: boolean;
  onLoadMore: (after: string | null) => void;
  count?: number;
  totalCount?: number;
  pageInfo?: { hasNextPage: boolean, endCursor: string | null };
};

export function Pagination({count, totalCount, pageInfo, onLoadMore, loading}: PaginationProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {count && totalCount ? <ProgressIndicator count={count} totalCount={totalCount}/> : null}
      <Button
        variant="outline"
        size="wide"
        onClick={() => onLoadMore(pageInfo?.endCursor ?? null)}
        disabled={loading}
      >
        {loading ? "Loading…" : "Load More"}
      </Button>
    </div>
  );
}

function ProgressIndicator({count, totalCount}: { count: number, totalCount: number }) {
  return (
    <div className="w-full max-w-xs">
      <div className="mb-2 flex justify-between">
              <span className="font-sans text-2xs tracking-widest uppercase text-ring">
                Showing
              </span>
        <span className="font-sans text-2xs tracking-widest uppercase text-ring">
                {count} of {totalCount}
              </span>
      </div>
      <div className="h-px w-full bg-border">
        <div
          className="h-px bg-foreground transition-all duration-500"
          style={{width: `${(count / totalCount) * 100}%`}}
        />
      </div>
    </div>
  );
}
