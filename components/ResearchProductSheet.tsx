"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

/**
 * Bottom sheet that shows a research product's full image and details, plus
 * a folder-selection grid. Distinct from SaveSheet because research items are
 * curated browse — we want a richer detail view rather than a swipe-save
 * confirmation.
 */
export function ResearchProductSheet({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const allFolders = useStore((s) => s.folders);
  const folders = allFolders
    .filter((f) => !f.archived)
    .sort((a, b) => a.order - b.order);
  const folderItems = useStore((s) => s.folderItems);
  const addToFolder = useStore((s) => s.addToFolder);
  const removeFromFolder = useStore((s) => s.removeFromFolder);

  const open = product !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && product && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl pb-safe"
          >
            <div className="mx-auto mt-2.5 flex h-1.5 w-10 items-center justify-center rounded-full bg-border" />

            <div className="flex items-center justify-end px-3 pt-1">
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="aspect-square w-full rounded-2xl object-cover sm:w-72 sm:shrink-0"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-background text-xs text-muted-2 sm:w-72 sm:shrink-0">
                    No image
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    {product.retailer}
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold leading-snug">
                    {product.title}
                  </h2>
                  {product.priceDisplay && (
                    <p className="mt-1 text-base font-semibold">
                      {product.priceDisplay}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
                    <span className="rounded-full bg-background px-2 py-0.5 capitalize">
                      {product.category}
                    </span>
                    {product.metalType && (
                      <span className="rounded-full bg-background px-2 py-0.5">
                        {product.metalType}
                      </span>
                    )}
                    {product.stoneType && (
                      <span className="rounded-full bg-background px-2 py-0.5">
                        {product.stoneType}
                      </span>
                    )}
                  </div>
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-foreground hover:text-background"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open at {product.retailer}
                  </a>
                </div>
              </div>

              <hr className="my-4 border-border" />

              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-2">
                Save to folders
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {folders.map((folder) => {
                  const itemInFolder = folderItems.find(
                    (fi) => fi.productId === product.id && fi.folderId === folder.id,
                  );
                  const isIn = !!itemInFolder;
                  return (
                    <FolderButton
                      key={folder.id}
                      name={folder.name}
                      color={folder.color}
                      selected={isIn}
                      onClick={() => {
                        if (isIn) removeFromFolder(itemInFolder.id);
                        else addToFolder(product.id, folder.id);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FolderButton({
  name,
  color,
  selected,
  onClick,
}: {
  name: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => {
        setPressed(true);
        setTimeout(() => setPressed(false), 180);
        onClick();
      }}
      className={`relative flex items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-3 text-left transition active:scale-[0.97] ${
        selected ? "bg-foreground/[0.04]" : "bg-background"
      } ${pressed ? "scale-[0.97]" : ""}`}
      style={{ borderColor: selected ? color : "var(--border)" }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-sm font-medium">{name}</span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0" style={{ color }} />}
    </button>
  );
}
