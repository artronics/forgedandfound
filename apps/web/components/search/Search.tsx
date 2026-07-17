"use client";

import React, {useEffect, useRef, useState} from "react";
import {Icon} from "@/components/ui/icon";
import {usePredictiveSearch} from "@/lib/search/usePredictiveSearch";
import {useSearchHistory} from "@/lib/search/useSearchHistory";
import {cn} from "@/lib/utils";
import Link from "next/link";
import {useRouter} from "next/navigation";

const POPULAR_SEARCHES = ["Gold ring", "Silver necklace", "Diamond earrings", "Bracelets", "Wedding band"];

interface SearchProps {
  onClose?: () => void;
}

export function Search({onClose}: SearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const {products, queries, loading, debouncedQuery, isActive} = usePredictiveSearch(query);
  const {history, addToHistory, clearHistory} = useSearchHistory();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (term: string) => {
    if (!term.trim()) return;
    addToHistory(term.trim());
    router.push(`/search?q=${encodeURIComponent(term.trim())}`);
    onClose?.();
  };

  const handleProductClick = () => {
    if (query.trim()) addToHistory(query.trim());
    onClose?.();
  };

  const handleSelectSuggestion = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const hasResults = products.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-0 md:gap-12 px-6 pt-2 pb-8 min-h-[300px]">

      {/* Left: Input + suggestions / popular */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">

        {/* Search input row */}
        <div
          className="flex items-center gap-3 border-b border-current/20 pb-3 focus-within:border-current/60 transition-colors">
          <Icon icon="search" size="md" className="text-muted-foreground shrink-0"/>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch(query)}
            placeholder="Search jewellery…"
            className="flex-1 bg-transparent outline-none text-base md:text-lg placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <Icon icon="x" size="sm"/>
            </button>
          )}
        </div>

        {/* Autocomplete suggestions from Shopify */}
        {isActive && queries.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1">Suggestions</p>
            {queries.slice(0, 5).map(q => (
              <button
                key={q.text}
                onClick={() => handleSelectSuggestion(q.text)}
                className="flex items-center gap-3 px-2 py-2 -mx-2 rounded hover:bg-muted/40 transition-colors text-left group"
              >
                <Icon icon="search" size="sm" className="text-muted-foreground shrink-0"/>
                <span
                  className="text-sm flex-1 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{__html: q.styledText}}
                />
                <Icon
                  icon="arrow-right"
                  size="sm"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </button>
            ))}
          </div>
        )}

        {/* Recent history */}
        {!isActive && history.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-widest uppercase text-muted-foreground">Recent</p>
              <button
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              {history.map(term => (
                <button
                  key={term}
                  onClick={() => handleSelectSuggestion(term)}
                  className="flex items-center gap-3 px-2 py-2 -mx-2 rounded hover:bg-muted/40 transition-colors text-left"
                >
                  <Icon icon="search" size="sm" className="text-muted-foreground shrink-0"/>
                  <span className="text-sm">{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Popular searches */}
        {!isActive && (
          <div className="flex flex-col gap-3">
            <p className="text-xs tracking-widest uppercase text-muted-foreground">Popular</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map(term => (
                <button
                  key={term}
                  onClick={() => handleSelectSuggestion(term)}
                  className="text-sm px-3 py-1.5 border border-muted-foreground/25 rounded-full hover:border-foreground transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      {isActive && <div className="hidden md:block w-px bg-muted/40 self-stretch my-2"/>}

      {/* Right: Product result cards */}
      <div
        className={cn(
          "flex flex-col gap-3 transition-all duration-200",
          isActive ? "mt-6 md:mt-0 md:w-72 opacity-100" : "hidden",
        )}
      >
        {isActive && (
          <p className="text-xs tracking-widest uppercase text-muted-foreground">Products</p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground animate-pulse">Searching…</span>
          </div>
        )}

        {!loading && hasResults && products.slice(0, 3).map(product => (
          <Link
            key={product.id}
            href={`/products/${product.handle}`}
            onClick={handleProductClick}
            className="flex gap-4 group py-3 border-b border-muted/30 last:border-0"
          >
            <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-muted/30">
              {product.featuredImage && (
                <img
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText ?? product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
            </div>
            <div className="flex flex-col justify-center gap-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{product.title}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatPrice(product.priceRange.minVariantPrice)}
              </p>
            </div>
          </Link>
        ))}

        {!loading && isActive && !hasResults && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">No results for &ldquo;{debouncedQuery}&rdquo;</span>
          </div>
        )}
      </div>

    </div>
  );
}

function formatPrice(price: { amount: string; currencyCode: string }) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: price.currencyCode,
  }).format(parseFloat(price.amount));
}
