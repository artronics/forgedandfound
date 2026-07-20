import React from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {cn} from "@/lib/utils";

/** One titled section of the account page — all sections share this frame. */
export function Section({title, description, children, className}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("bg-surface-container px-6", className)}>
      <CardHeader className="px-0 pt-6 pb-0">
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="px-0 pt-4 pb-6">{children}</CardContent>
    </Card>
  );
}

/** A labelled form field with the account page's shared label styling. */
export function Field({id, label, error, children}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Inline outcome line under a form: error in red, success in normal text. */
export function FormStatus({error, success}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (success) return <p className="text-xs text-muted-foreground">{success}</p>;
  return null;
}
