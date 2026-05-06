"use client";

import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import type { JewelryCategory } from "@/lib/types";

export function CategoryFilter() {
  const category = useStore((s) => s.filter.category);
  const setFilter = useStore((s) => s.setFilter);
  const products = useStore((s) => s.products);

  const counts = countNew(products);
  const total = products.filter((p) => p.status === "new").length;

  const select = (val: JewelryCategory | "all") =>
    setFilter({ category: val });

  return (
    <div className="-mx-4 overflow-x-auto no-scrollbar">
      <div className="flex w-max gap-1.5 px-4 pb-1">
        <Chip
          active={category === "all"}
          onClick={() => select("all")}
          label={`All · ${total}`}
        />
        {CATEGORIES.map((c) => {
          const n = counts[c.value] ?? 0;
          if (n === 0 && category !== c.value) return null;
          return (
            <Chip
              key={c.value}
              active={category === c.value}
              onClick={() => select(c.value)}
              label={`${c.label} · ${n}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-tight transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function countNew(
  products: { status: string; category: JewelryCategory }[],
): Record<JewelryCategory, number> {
  const out = {} as Record<JewelryCategory, number>;
  for (const p of products) {
    if (p.status !== "new") continue;
    out[p.category] = (out[p.category] ?? 0) + 1;
  }
  return out;
}
