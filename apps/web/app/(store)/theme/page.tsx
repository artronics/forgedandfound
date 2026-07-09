"use client";

import React from "react";
import {ArrowRight, CreditCard, Leaf, ShieldCheck, ShoppingBag} from "lucide-react";

const swatches = [
  {label: "Background", token: "bg-background text-foreground border-border"},
  {label: "Surface / card", token: "bg-card text-card-foreground border-border"},
  {label: "Surface container", token: "bg-surface-container text-foreground border-border"},
  {label: "Primary", token: "bg-primary text-primary-foreground border-primary"},
  {label: "Primary container", token: "bg-primary-container text-primary-foreground border-primary-container"},
  {label: "Secondary", token: "bg-secondary text-secondary-foreground border-secondary"},
  {label: "Accent", token: "bg-accent text-accent-foreground border-accent"},
  {label: "Muted", token: "bg-muted text-muted-foreground border-border"},
  {label: "Destructive", token: "bg-destructive text-destructive-foreground border-destructive"},
  {label: "Sidebar", token: "bg-sidebar text-sidebar-foreground border-sidebar-border"},
];

const tokenLines = [
  ["Canvas", "bg-background", "text-foreground"],
  ["Card", "bg-card", "text-card-foreground", "border-border"],
  ["Nested panel", "bg-surface-container", "border-border"],
  ["Subtle panel", "bg-card", "border-border/40"],
  ["High emphasis", "bg-primary", "text-primary-foreground"],
  ["Supporting action", "bg-accent", "text-accent-foreground"],
  ["Muted copy", "text-muted-foreground"],
  ["Hairline border", "border-border"],
  ["Focus / ring", "ring-ring"],
];

function Pill({children}: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </span>
  );
}

export default function ForgedFoundBasketReference() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-12">
        <header className="mb-10 border-b border-border/40 pb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                Forged &amp; Found · token reference
              </p>
              <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Basket hierarchy study</h1>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Pill>surface</Pill>
              <Pill>container</Pill>
              <Pill>contrast</Pill>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            This is not a functional basket page. It is a compact composition showing how the palette establishes
            hierarchy:
            page canvas, content cards, summary modules, borders, muted copy, call-to-action emphasis, and inverse
            footer treatment.
          </p>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {swatches.map((item) => (
            <div key={item.label} className={`rounded-sm border p-4 ${item.token}`}>
              <div className="mb-10 h-16 rounded-sm border border-black/5 bg-white/10"/>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Token</p>
              <h2 className="mt-1 font-serif text-lg">{item.label}</h2>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-sm border border-border/50 bg-card p-6 ambient-shadow">
              <div className="mb-6 flex items-start justify-between gap-6 border-b border-border/30 pb-6">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Main content
                    card</p>
                  <h2 className="font-serif text-3xl">How surfaces stack</h2>
                </div>
                <div
                  className="rounded-sm border border-border/50 bg-card px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  border + low container
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <article className="rounded-sm border border-border/40 bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Item module</p>
                      <h3 className="mt-1 font-serif text-2xl">Primary content zone</h3>
                    </div>
                    <ShoppingBag className="h-5 w-5 text-primary"/>
                  </div>
                  <p className="mb-5 text-sm leading-6 text-muted-foreground">
                    Use the container-low surface for rows and sectional modules that should separate from the page
                    without becoming dominant.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="bg-editorial-gradient rounded-sm px-5 py-3 text-[12px] uppercase tracking-[0.22em] text-primary-foreground transition-opacity hover:opacity-90">
                      Primary action
                    </button>
                    <button
                      className="rounded-sm border border-border/50 bg-background px-5 py-3 text-[12px] uppercase tracking-[0.22em] text-foreground hover:bg-popover">
                      Secondary action
                    </button>
                  </div>
                </article>

                <article className="rounded-sm border border-border/40 bg-surface-container p-5">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Border
                    treatment</p>
                  <div className="space-y-3">
                    <div className="rounded-sm border border-border bg-background p-3">
                      <span className="text-sm">Standard divider on neutral canvas</span>
                    </div>
                    <div className="rounded-sm border border-border bg-muted p-3">
                      <span className="text-sm">Outline variant for quieter framing</span>
                    </div>
                    <div
                      className="rounded-sm border border-primary/30 bg-accent p-3 text-accent-foreground">
                      <span className="text-sm">Tinted emphasis border for editorial callouts</span>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-sm border border-border/50 bg-surface-container p-6">
                <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Type and
                  contrast</p>
                <h3 className="mb-2 font-serif text-3xl">Text roles</h3>
                <p className="mb-5 max-w-xl text-sm leading-7 text-muted-foreground">
                  The page works because the majority of text sits on on-background and on-accent, while primary
                  is reserved for intent,
                  pricing emphasis, and active states.
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-border/30 pb-3">
                    <span className="text-muted-foreground">Supporting copy</span>
                    <span className="text-primary">Highlighted value</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/30 pb-3">
                    <span className="text-foreground">Default body text</span>
                    <span className="text-secondary">Warm supporting accent</span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-muted-foreground">Muted label</span>
                    <span
                      className="rounded-full bg-accent px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-accent-foreground">
                      Accent chip
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-border/50 bg-card p-6">
                <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Status blocks</p>
                <div className="space-y-3">
                  <div
                    className="rounded-sm border border-secondary/20 bg-secondary p-4 text-secondary-foreground">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <CreditCard className="h-4 w-4"/>
                      Supporting commerce state
                    </div>
                    <p className="text-sm opacity-80">Use for information that should feel warm but not dominant.</p>
                  </div>
                  <div
                    className="rounded-sm border border-border/40 bg-muted p-4 text-foreground">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4"/>
                      Assurance block
                    </div>
                    <p className="text-sm opacity-80">Works well for provenance, trust, and craft storytelling.</p>
                  </div>
                  <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <ArrowRight className="h-4 w-4"/>
                      Error / warning token
                    </div>
                    <p className="text-sm opacity-80">Present but clearly separate from the editorial neutrals.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-sm border border-border/50 bg-surface-container p-6 lg:sticky lg:top-8">
              <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Summary module</p>
              <h2 className="mb-6 font-serif text-3xl">Hierarchy sample</h2>
              <div className="space-y-4 border-b border-border/30 pb-6 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="text-foreground">£2,270.00</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="italic text-primary">Complimentary</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Estimated tax</span>
                  <span className="text-foreground">£454.00</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between py-6">
                <span className="font-serif text-lg">Total</span>
                <span className="font-serif text-3xl">£2,724.00</span>
              </div>
              <button
                className="bg-editorial-gradient mb-5 flex w-full items-center justify-center gap-3 rounded-sm px-5 py-4 text-[12px] uppercase tracking-[0.24em] text-primary-foreground hover:opacity-90">
                <ShoppingBag className="h-4 w-4"/>
                Primary checkout button
              </button>
              <button
                className="w-full rounded-sm border border-border/40 bg-background px-5 py-4 text-[12px] uppercase tracking-[0.24em] text-foreground hover:bg-popover">
                Quiet secondary button
              </button>
              <div className="mt-6 space-y-3 border-t border-border/30 pt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Leaf className="h-4 w-4 text-primary"/>
                  Eco-conscious packaging treatment
                </div>
                <div
                  className="rounded-sm border border-border/40 bg-muted p-4 text-xs leading-6">
                  This is the recommended formula for a supporting informational panel inside a summary sidebar.
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground">
              <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-sidebar-foreground/70">Inverse footer /
                sidebar concept</p>
              <h3 className="mb-3 font-serif text-3xl">Dark anchor</h3>
              <p className="mb-5 text-sm leading-7 text-sidebar-foreground/80">
                The inverse surface gives the system a strong closing section. Use sidebar tokens for footer zones,
                overlays, or editorial nav panels.
              </p>
              <div className="flex flex-wrap gap-3">
                <span
                  className="rounded-full bg-sidebar-primary px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sidebar-primary-foreground">
                  inverse primary
                </span>
                <span
                  className="rounded-full border border-sidebar-border px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/80">
                  sidebar border
                </span>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-sm border border-border/40 bg-card p-6">
          <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Recommended token
            usage</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tokenLines.map((line) => (
              <div key={line.join("-")} className="rounded-sm border border-border/30 bg-background p-4">
                <p className="mb-2 font-serif text-lg">{line[0]}</p>
                <div className="space-y-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {line.slice(1).map((token) => (
                    <div key={token}>{token}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
