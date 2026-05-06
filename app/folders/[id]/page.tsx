"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/Badge";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { FolderItem, Product } from "@/lib/types";

export default function FolderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);

  const folder = useStore((s) => s.folders.find((f) => f.id === params.id));
  const items = useStore((s) =>
    s.folderItems
      .filter((fi) => fi.folderId === params.id)
      .sort(
        (a, b) =>
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
      ),
  );
  const productsById = useStore((s) => new Map(s.products.map((p) => [p.id, p])));

  const removeFolder = useStore((s) => s.removeFolder);
  const updateFolder = useStore((s) => s.updateFolder);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder?.name ?? "");

  if (!hydrated) {
    return <main className="flex flex-1 items-center justify-center px-6 pt-safe" />;
  }

  if (!folder) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="text-muted">Folder not found.</p>
        <Link href="/folders" className="mt-3 text-sm font-medium underline">
          Back to folders
        </Link>
      </main>
    );
  }

  const products = items
    .map((it) => {
      const p = productsById.get(it.productId);
      return p ? { item: it, product: p } : null;
    })
    .filter((x): x is { item: FolderItem; product: Product } => x !== null);

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) {
      updateFolder(folder.id, { name: trimmed });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    if (
      confirm(
        `Delete folder "${folder.name}"? Saved products will stay in your saved list but be removed from this folder.`,
      )
    ) {
      removeFolder(folder.id);
      router.push("/folders");
    }
  };

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe">
      <header className="flex items-center gap-3 py-3">
        <Link
          href="/folders"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: folder.color }}
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={handleRename} className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-2 py-1 text-base font-semibold outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background"
              >
                Save
              </button>
            </form>
          ) : (
            <div>
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {folder.name}
              </h1>
              <p className="text-xs text-muted-2">
                {products.length} {products.length === 1 ? "product" : "products"}
              </p>
            </div>
          )}
        </div>
        {!editing && (
          <>
            <button
              onClick={() => {
                setName(folder.name);
                setEditing(true);
              }}
              aria-label="Rename folder"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-card"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              aria-label="Delete folder"
              className="flex h-9 w-9 items-center justify-center rounded-full text-skip hover:bg-card"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </header>

      {products.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-center text-muted">
          Empty for now. Swipe-save products and tap this folder to fill it up.
        </div>
      ) : (
        <ul className="flex flex-col gap-3 pb-4">
          {products.map(({ item, product }) => (
            <FolderProductRow key={item.id} item={item} product={product} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FolderProductRow({
  item,
  product,
}: {
  item: FolderItem;
  product: Product;
}) {
  const removeFromFolder = useStore((s) => s.removeFromFolder);
  const updateFolderItem = useStore((s) => s.updateFolderItem);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt={product.title}
        className="h-24 w-24 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-2">
          {product.retailer}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          {product.title}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          {product.priceDisplay && (
            <span className="text-sm font-semibold">{product.priceDisplay}</span>
          )}
          <Badge tone="accent">{CATEGORY_LABEL[product.category]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className="text-muted hover:text-foreground"
          >
            {item.notes ? "Edit note" : "Add note"}
          </button>
          <button
            onClick={() => removeFromFolder(item.id)}
            className="ml-auto text-skip hover:underline"
          >
            Remove
          </button>
        </div>
        {item.notes && !notesOpen && (
          <p className="mt-1.5 line-clamp-2 rounded-lg bg-background px-2 py-1 text-xs italic text-muted">
            {item.notes}
          </p>
        )}
        {notesOpen && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. great price point · show to client X"
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
              rows={2}
            />
            <button
              onClick={() => {
                updateFolderItem(item.id, { notes: notes.trim() || undefined });
                setNotesOpen(false);
              }}
              className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
