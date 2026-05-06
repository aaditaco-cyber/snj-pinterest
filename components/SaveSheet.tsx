"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export function SaveSheet({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const folders = useStore((s) =>
    s.folders.filter((f) => !f.archived).sort((a, b) => a.order - b.order),
  );
  const folderItems = useStore((s) => s.folderItems);
  const addToFolder = useStore((s) => s.addToFolder);
  const removeFromFolder = useStore((s) => s.removeFromFolder);

  const open = product !== null;

  // Close sheet on Escape
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
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl pb-safe"
          >
            <div className="mx-auto flex h-1.5 w-10 items-center justify-center rounded-full bg-border mt-2.5" />

            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-2">Saved to bucket</p>
                <h3 className="truncate text-base font-semibold">{product.title}</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6 pt-2">
              <p className="mb-3 text-sm text-muted">
                Tap a folder to add (or remove). A product can live in many folders.
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

              <div className="mt-4 flex justify-center">
                <button
                  onClick={onClose}
                  className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90"
                >
                  Done
                </button>
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
  // Subtle "stuck in" press animation
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
      <span className="flex items-center gap-2 min-w-0">
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
