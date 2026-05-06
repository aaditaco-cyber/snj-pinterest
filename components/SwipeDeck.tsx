"use client";

import { AnimatePresence, motion } from "motion/react";
import { Heart, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { SwipeCard } from "./SwipeCard";
import { SaveSheet } from "./SaveSheet";

const VISIBLE_STACK = 3;

export function SwipeDeck({ deck }: { deck: Product[] }) {
  const skipProduct = useStore((s) => s.skipProduct);
  const saveProduct = useStore((s) => s.saveProduct);
  const undoLastSwipe = useStore((s) => s.undoLastSwipe);
  const recentSwipes = useStore((s) => s.recentSwipes);

  const [savedProduct, setSavedProduct] = useState<Product | null>(null);

  const handleSwipe = (product: Product, direction: "skip" | "save") => {
    if (direction === "save") {
      void saveProduct(product.id);
      setSavedProduct(product);
    } else {
      void skipProduct(product.id);
    }
  };

  // Keyboard shortcuts: ← skip, → save, ↑ undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const top = deck[0];
      if (e.key === "ArrowLeft" && top) {
        e.preventDefault();
        handleSwipe(top, "skip");
      } else if (e.key === "ArrowRight" && top) {
        e.preventDefault();
        handleSwipe(top, "save");
      } else if (e.key === "ArrowUp" && recentSwipes.length > 0) {
        e.preventDefault();
        undoLastSwipe();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, recentSwipes.length]);

  const visible = deck.slice(0, VISIBLE_STACK);

  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <div className="relative w-full max-w-sm aspect-[3/4.4] mt-2">
        <AnimatePresence>
          {visible.length === 0 ? (
            <EmptyState key="empty" />
          ) : (
            visible
              .slice()
              .reverse()
              .map((p, idxFromBottom) => {
                const stackIndex = visible.length - 1 - idxFromBottom;
                const isTop = stackIndex === 0;
                return (
                  <SwipeCard
                    key={p.id}
                    product={p}
                    stackIndex={stackIndex}
                    isTop={isTop}
                    onSwipe={(dir) => handleSwipe(p, dir)}
                  />
                );
              })
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <ActionButton
          ariaLabel="Skip"
          onClick={() => deck[0] && handleSwipe(deck[0], "skip")}
          disabled={deck.length === 0}
          className="bg-card border-skip/30 text-skip hover:bg-skip/[0.06]"
        >
          <X className="h-7 w-7" strokeWidth={2.5} />
        </ActionButton>

        <ActionButton
          ariaLabel="Undo last swipe"
          onClick={() => undoLastSwipe()}
          disabled={recentSwipes.length === 0}
          size="sm"
          className="bg-card border-border text-muted hover:bg-background"
        >
          <Undo2 className="h-5 w-5" />
        </ActionButton>

        <ActionButton
          ariaLabel="Save"
          onClick={() => deck[0] && handleSwipe(deck[0], "save")}
          disabled={deck.length === 0}
          className="bg-card border-save/30 text-save hover:bg-save/[0.06]"
        >
          <Heart className="h-7 w-7" strokeWidth={2.5} />
        </ActionButton>
      </div>

      <p className="mt-3 hidden text-xs text-muted-2 sm:block">
        ← skip · → save · ↑ undo
      </p>

      <SaveSheet product={savedProduct} onClose={() => setSavedProduct(null)} />
    </div>
  );
}

function ActionButton({
  children,
  ariaLabel,
  onClick,
  disabled,
  className = "",
  size = "lg",
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: "lg" | "sm";
}) {
  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`flex ${dim} items-center justify-center rounded-full border-2 shadow-sm transition disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </motion.button>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border p-8 text-center"
    >
      <div className="mb-3 text-4xl">✨</div>
      <h3 className="text-lg font-semibold">All caught up</h3>
      <p className="mt-1 max-w-[18rem] text-sm text-muted">
        You&apos;ve reviewed every new arrival. Add a source or restore skipped
        products from settings to keep going.
      </p>
    </motion.div>
  );
}
