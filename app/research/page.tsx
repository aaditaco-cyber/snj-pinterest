"use client";

import { Bookmark, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { ResearchProductSheet } from "@/components/ResearchProductSheet";
import { ResearchSourceSheet } from "@/components/ResearchSourceSheet";
import type { JewelryCategory, Product } from "@/lib/types";

type ResearchSort = "newest" | "price-low" | "price-high";

interface ResearchFilter {
  category: JewelryCategory | "all";
  sort: ResearchSort;
  selectedSourceIds: Set<string>; // empty = all research sources
  priceMin?: number;
  priceMax?: number;
}

const DEFAULT_FILTER: ResearchFilter = {
  category: "all",
  sort: "newest",
  selectedSourceIds: new Set(),
};

export default function ResearchPage() {
  const hydrated = useStore((s) => s.hydrated);
  const allProducts = useStore((s) => s.products);
  const allSources = useStore((s) => s.sources);
  const folderItems = useStore((s) => s.folderItems);

  const researchSources = useMemo(
    () => allSources.filter((s) => s.kind === "research"),
    [allSources],
  );
  const researchSourceIds = useMemo(
    () => new Set(researchSources.map((s) => s.id)),
    [researchSources],
  );

  const [filter, setFilter] = useState<ResearchFilter>(DEFAULT_FILTER);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);

  const savedProductIds = useMemo(
    () => new Set(folderItems.map((fi) => fi.productId)),
    [folderItems],
  );

  const products = useMemo(() => {
    return filterAndSort(allProducts, researchSourceIds, filter);
  }, [allProducts, researchSourceIds, filter]);

  if (!hydrated) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 pt-safe">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-border border-t-accent" />
      </main>
    );
  }

  const noSources = researchSources.length === 0;

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-4">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Research</h1>
          <p className="text-xs text-muted-2">
            {products.length} item{products.length === 1 ? "" : "s"} ·{" "}
            {researchSources.length} source
            {researchSources.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => setSourceSheetOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {noSources ? "Add source" : "Edit sources"}
        </button>
      </header>

      <FilterBar
        filter={filter}
        sources={researchSources}
        onChange={(patch) => setFilter((f) => ({ ...f, ...patch }))}
      />

      {noSources ? (
        <EmptyState onOpen={() => setSourceSheetOpen(true)} />
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-2">
          No products match these filters.
        </p>
      ) : (
        <Grid
          products={products}
          savedIds={savedProductIds}
          onSelect={setOpenProduct}
        />
      )}

      <ResearchProductSheet
        product={openProduct}
        onClose={() => setOpenProduct(null)}
      />
      <ResearchSourceSheet
        open={sourceSheetOpen}
        onClose={() => setSourceSheetOpen(false)}
      />
    </main>
  );
}

function filterAndSort(
  products: Product[],
  researchSourceIds: Set<string>,
  filter: ResearchFilter,
): Product[] {
  const sourceFilterActive = filter.selectedSourceIds.size > 0;
  return products
    .filter((p) => p.sourceId && researchSourceIds.has(p.sourceId))
    .filter(
      (p) =>
        !sourceFilterActive ||
        (p.sourceId && filter.selectedSourceIds.has(p.sourceId)),
    )
    .filter((p) => filter.category === "all" || p.category === filter.category)
    .filter((p) => {
      if (filter.priceMin != null && (p.price ?? 0) < filter.priceMin) return false;
      if (filter.priceMax != null && (p.price ?? Infinity) > filter.priceMax) return false;
      return true;
    })
    .sort((a, b) => {
      if (filter.sort === "price-low") return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (filter.sort === "price-high") return (b.price ?? -1) - (a.price ?? -1);
      return (
        new Date(b.dateDiscovered).getTime() -
        new Date(a.dateDiscovered).getTime()
      );
    });
}

function FilterBar({
  filter,
  sources,
  onChange,
}: {
  filter: ResearchFilter;
  sources: { id: string; name: string }[];
  onChange: (patch: Partial<ResearchFilter>) => void;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <PillButton
          active={filter.category === "all"}
          onClick={() => onChange({ category: "all" })}
        >
          All
        </PillButton>
        {CATEGORIES.map((c) => (
          <PillButton
            key={c.value}
            active={filter.category === c.value}
            onClick={() => onChange({ category: c.value })}
          >
            {c.label}
          </PillButton>
        ))}

        <span className="mx-1 h-4 w-px bg-border" />

        <select
          value={filter.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as ResearchSort })
          }
          className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium"
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price: low</option>
          <option value="price-high">Price: high</option>
        </select>

        {sources.length > 1 && (
          <SourceMultiSelect
            sources={sources}
            selected={filter.selectedSourceIds}
            onToggle={(id) => {
              const next = new Set(filter.selectedSourceIds);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              onChange({ selectedSourceIds: next });
            }}
            onClear={() => onChange({ selectedSourceIds: new Set() })}
          />
        )}

        <PriceRange
          min={filter.priceMin}
          max={filter.priceMax}
          onChange={(priceMin, priceMax) =>
            onChange({ priceMin, priceMax })
          }
        />
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-medium transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SourceMultiSelect({
  sources,
  selected,
  onToggle,
  onClear,
}: {
  sources: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    selected.size === 0
      ? "All sources"
      : selected.size === 1
        ? sources.find((s) => selected.has(s.id))?.name ?? "1 source"
        : `${selected.size} sources`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-2.5 py-1 font-medium ${
          selected.size > 0
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-muted hover:text-foreground"
        }`}
      >
        {label}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-2">
                Sources
              </span>
              {selected.size > 0 && (
                <button
                  onClick={onClear}
                  className="text-[11px] text-muted hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => onToggle(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                  selected.has(s.id)
                    ? "bg-foreground/[0.06] font-medium"
                    : "hover:bg-background"
                }`}
              >
                <span
                  className={`h-3 w-3 shrink-0 rounded border ${
                    selected.has(s.id)
                      ? "border-foreground bg-foreground"
                      : "border-border"
                  }`}
                />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PriceRange({
  min,
  max,
  onChange,
}: {
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = min != null || max != null;
  const label = active
    ? `${min ?? 0}–${max ?? "∞"}`
    : "Any price";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-2.5 py-1 font-medium ${
          active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-muted hover:text-foreground"
        }`}
      >
        {label}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-2xl border border-border bg-card p-3 shadow-lg">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-2">
              Price range (USD)
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={min ?? ""}
                placeholder="Min"
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  onChange(Number.isFinite(n) ? n : undefined, max);
                }}
                className="w-1/2 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <input
                type="number"
                value={max ?? ""}
                placeholder="Max"
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  onChange(min, Number.isFinite(n) ? n : undefined);
                }}
                className="w-1/2 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
              />
            </div>
            {active && (
              <button
                onClick={() => onChange(undefined, undefined)}
                className="mt-2 w-full rounded-full bg-background py-1 text-[11px] font-medium text-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Grid({
  products,
  savedIds,
  onSelect,
}: {
  products: Product[];
  savedIds: Set<string>;
  onSelect: (p: Product) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <Card
          key={p.id}
          product={p}
          saved={savedIds.has(p.id)}
          onClick={() => onSelect(p)}
        />
      ))}
    </ul>
  );
}

function Card({
  product,
  saved,
  onClick,
}: {
  product: Product;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-foreground/30"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-background">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-2">
              No image
            </div>
          )}
          {saved && (
            <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-foreground/85 px-1.5 py-0.5 text-[9px] font-medium text-background backdrop-blur">
              <Bookmark className="h-2.5 w-2.5 fill-current" />
              Saved
            </span>
          )}
        </div>
        <div className="px-2 py-1.5">
          <p className="truncate text-[10px] uppercase tracking-wide text-muted-2">
            {product.retailer}
          </p>
          <p className="line-clamp-2 text-xs font-medium leading-snug">
            {product.title}
          </p>
          {product.priceDisplay && (
            <p className="mt-0.5 text-xs font-semibold">
              {product.priceDisplay}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h2 className="text-base font-semibold">No research sources yet</h2>
      <p className="mt-1 max-w-xs text-xs text-muted">
        Add the URLs of jewelry pages you want to mine — best-seller lists,
        category landings, anywhere with structured product data. We&apos;ll
        scrape them on demand.
      </p>
      <button
        onClick={onOpen}
        className="mt-4 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
      >
        Add your first source
      </button>
    </div>
  );
}
