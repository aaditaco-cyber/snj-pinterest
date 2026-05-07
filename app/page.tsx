"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { SwipeDeck } from "@/components/SwipeDeck";
import { CategoryFilter } from "@/components/CategoryFilter";
import type { Product } from "@/lib/types";

export default function Home() {
  const hydrated = useStore((s) => s.hydrated);
  const products = useStore((s) => s.products);
  const sources = useStore((s) => s.sources);
  const filter = useStore((s) => s.filter);

  // Products from research sources should never appear in the swipe deck —
  // research is a deliberate browse experience, not a swipe through everything.
  const researchSourceIds = useMemo(
    () => new Set(sources.filter((s) => s.kind === "research").map((s) => s.id)),
    [sources],
  );

  if (!hydrated) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 pt-safe">
        <div className="h-12 w-12 rounded-full border-2 border-border border-t-accent animate-spin" />
      </main>
    );
  }

  const deck = filterDeck(products, researchSourceIds, filter.category);

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-4">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Discover</h1>
          <p className="text-xs text-muted-2">
            {deck.length} {deck.length === 1 ? "product" : "products"} to review
          </p>
        </div>
      </header>

      <CategoryFilter />

      <div className="flex flex-1 flex-col items-center justify-center pt-2">
        <SwipeDeck deck={deck} />
      </div>
    </main>
  );
}

function filterDeck(
  products: Product[],
  researchSourceIds: Set<string>,
  category: string,
): Product[] {
  return products
    .filter((p) => p.status === "new")
    .filter((p) => !p.sourceId || !researchSourceIds.has(p.sourceId))
    .filter((p) => category === "all" || p.category === category)
    .sort(
      (a, b) =>
        new Date(b.dateDiscovered).getTime() -
        new Date(a.dateDiscovered).getTime(),
    );
}
