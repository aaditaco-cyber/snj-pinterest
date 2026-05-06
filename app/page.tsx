"use client";

import { useStore } from "@/lib/store";
import { SwipeDeck } from "@/components/SwipeDeck";
import type { Product } from "@/lib/types";

export default function Home() {
  const hydrated = useStore((s) => s.hydrated);
  const products = useStore((s) => s.products);
  const filter = useStore((s) => s.filter);

  if (!hydrated) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 pt-safe">
        <div className="h-12 w-12 rounded-full border-2 border-border border-t-accent animate-spin" />
      </main>
    );
  }

  const deck = filterDeck(products, filter.category);

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-8">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Discover</h1>
          <p className="text-xs text-muted-2">
            {deck.length} {deck.length === 1 ? "product" : "products"} to review
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center">
        <SwipeDeck deck={deck} />
      </div>
    </main>
  );
}

function filterDeck(products: Product[], category: string): Product[] {
  return products
    .filter((p) => p.status === "new")
    .filter((p) => category === "all" || p.category === category)
    .sort(
      (a, b) =>
        new Date(b.dateDiscovered).getTime() -
        new Date(a.dateDiscovered).getTime(),
    );
}
