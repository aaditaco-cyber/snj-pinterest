"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/Badge";
import { CATEGORY_LABEL } from "@/lib/categories";

export default function SettingsPage() {
  const hydrated = useStore((s) => s.hydrated);
  const products = useStore((s) => s.products);
  const folders = useStore((s) => s.folders);
  const sources = useStore((s) => s.sources);
  const folderItems = useStore((s) => s.folderItems);
  const restoreSkippedProduct = useStore((s) => s.restoreSkippedProduct);
  const restoreAllSkipped = useStore((s) => s.restoreAllSkipped);
  const resetAll = useStore((s) => s.resetAll);

  if (!hydrated) {
    return <main className="flex flex-1 items-center justify-center px-6 pt-safe" />;
  }

  const total = products.length;
  const saved = products.filter((p) => p.status === "saved").length;
  const skipped = products.filter((p) => p.status === "skipped").length;
  const reviewing = products.filter((p) => p.status === "new").length;
  const skippedProducts = products
    .filter((p) => p.status === "skipped")
    .sort(
      (a, b) =>
        new Date(b.dateDiscovered).getTime() -
        new Date(a.dateDiscovered).getTime(),
    );

  const handleReset = () => {
    if (
      confirm(
        "Reset all data? This wipes your saved products, folders you created, and sources you added. Default folders/sources/seed products are restored. This can't be undone.",
      )
    ) {
      resetAll();
    }
  };

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-4">
      <header className="py-3">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-2">Stats, skipped products, reset</p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Reviewing" value={reviewing} />
        <Stat label="Saved" value={saved} accent="save" />
        <Stat label="Skipped" value={skipped} accent="skip" />
        <Stat label="Folders" value={folders.length} />
      </section>
      <section className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sources" value={sources.length} />
        <Stat label="In folders" value={folderItems.length} />
        <Stat label="Total products" value={total} />
      </section>

      {/* Skipped products */}
      <section className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">Skipped products</h2>
            <p className="text-xs text-muted-2">
              Restore one to send it back to the swipe deck.
            </p>
          </div>
          {skippedProducts.length > 0 && (
            <button
              onClick={restoreAllSkipped}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore all
            </button>
          )}
        </div>

        {skippedProducts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Nothing skipped yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {skippedProducts.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover opacity-70"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    {p.retailer}
                  </p>
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {p.priceDisplay && (
                      <span className="text-xs font-semibold">
                        {p.priceDisplay}
                      </span>
                    )}
                    <Badge tone="muted">{CATEGORY_LABEL[p.category]}</Badge>
                  </div>
                </div>
                <button
                  onClick={() => restoreSkippedProduct(p.id)}
                  aria-label="Restore"
                  className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-card"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reset */}
      <section className="mt-8 rounded-2xl border border-skip/30 bg-skip/[0.04] p-4">
        <h2 className="text-sm font-semibold text-skip">Danger zone</h2>
        <p className="mt-1 text-xs text-muted">
          Wipes all saved products, custom folders, and added sources. Replaces
          everything with the default seed data.
        </p>
        <button
          onClick={handleReset}
          className="mt-3 flex items-center gap-1.5 rounded-full border border-skip/40 bg-card px-3 py-1.5 text-xs font-medium text-skip hover:bg-skip/[0.06]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Reset all data
        </button>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "save" | "skip";
}) {
  const accentColor =
    accent === "save"
      ? "text-save"
      : accent === "skip"
        ? "text-skip"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-2">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold tracking-tight ${accentColor}`}>
        {value}
      </p>
    </div>
  );
}
