"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { NewFolderForm } from "@/components/NewFolderForm";
import type { Folder } from "@/lib/types";

export default function FoldersPage() {
  const hydrated = useStore((s) => s.hydrated);
  const folders = useStore((s) =>
    s.folders.filter((f) => !f.archived).sort((a, b) => a.order - b.order),
  );

  if (!hydrated) {
    return <main className="flex flex-1 items-center justify-center px-6 pt-safe" />;
  }

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Folders</h1>
          <p className="text-xs text-muted-2">
            {folders.length} {folders.length === 1 ? "bucket" : "buckets"}
          </p>
        </div>
        <NewFolderForm />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {folders.map((f) => (
          <FolderCard key={f.id} folder={f} />
        ))}
      </div>

      {folders.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-16 text-center text-muted">
          No folders yet. Create one above to start organizing.
        </div>
      )}
    </main>
  );
}

function FolderCard({ folder }: { folder: Folder }) {
  const items = useStore((s) =>
    s.folderItems
      .filter((fi) => fi.folderId === folder.id)
      .sort(
        (a, b) =>
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
      ),
  );
  const products = useStore((s) => s.products);
  const productById = new Map(products.map((p) => [p.id, p]));
  const previews = items
    .map((it) => productById.get(it.productId))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);

  return (
    <Link
      href={`/folders/${folder.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-foreground/15 hover:shadow-sm"
    >
      <div className="grid h-16 w-16 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-background">
        {previews.length === 0 ? (
          <div
            className="col-span-2 row-span-2 flex items-center justify-center text-xs text-muted-2"
            style={{ backgroundColor: folder.color, opacity: 0.18 }}
          >
            empty
          </div>
        ) : (
          previews.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id + i}
              src={p.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ))
        )}
        {Array.from({ length: 4 - previews.length }).map((_, i) =>
          previews.length === 0 ? null : (
            <div
              key={`pad-${i}`}
              className="bg-background"
              style={{ backgroundColor: folder.color, opacity: 0.08 }}
            />
          ),
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: folder.color }}
          />
          <h3 className="truncate text-sm font-semibold">{folder.name}</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {items.length} {items.length === 1 ? "product" : "products"}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-2 transition group-hover:text-foreground" />
    </Link>
  );
}
