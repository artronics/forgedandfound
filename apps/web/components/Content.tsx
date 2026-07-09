import React from "react";
import {cn, sanitizeHtml} from "@/lib/utils";
import {Page, PageContent, PageHeader} from "@/components/Page";
import {Skeleton} from "@/components/ui/skeleton";

type ContentProps = {
  title: string;
  html?: string;
  loading?: boolean;
  className?: string;
};

export function Content({title, html, className, loading = false}: ContentProps) {
  if (loading) {
    return <ContentSkeleton/>;
  }
  return (
    <Page>
      <PageHeader className="text-3xl">{title}</PageHeader>
      <PageContent
        className="leading-6"
      >
        {loading ? (<p>Loading...</p>) : (
          <article
            className={cn(
              "flex flex-col gap-4",
              "[&>h2]:text-2xl [&>h2]:pt-4",
              "[&>ul]:list-disc [&>ul]:pl-4 [&>ul]:leading-6 [&>ul]:mt-2 [&>ul>li]:p-1",
              className,
            )}
            dangerouslySetInnerHTML={{__html: sanitizeHtml(html ?? "Content not found")}}/>)}
      </PageContent>
    </Page>
  );
}

export function ContentSkeleton() {
  return (
    <Page>
      <PageHeader className="text-3xl">
        <Skeleton className=" h-6 rounded-full bg-muted-foreground w-sm"/>
      </PageHeader>
      <PageContent
        className="leading-6"
      >
        <div className="flex gap-3 flex-col">
          <Skeleton className="h-5 w-md rounded-full bg-muted-foreground"/>
          <Skeleton className="h-5 w-full rounded-full bg-muted-foreground"/>
          <Skeleton className="h-5 w-full rounded-full bg-muted-foreground"/>
        </div>
      </PageContent>
    </Page>
  );
}