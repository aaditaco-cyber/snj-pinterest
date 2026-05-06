"use client";

import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import type { JewelryCategory, Source } from "@/lib/types";

export default function SourcesPage() {
  const hydrated = useStore((s) => s.hydrated);
  const allSources = useStore((s) => s.sources);
  const sources = [...allSources].sort((a, b) => a.name.localeCompare(b.name));

  if (!hydrated) {
    return <main className="flex flex-1 items-center justify-center px-6 pt-safe" />;
  }

  const active = sources.filter((s) => s.active).length;

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-4">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sources</h1>
          <p className="text-xs text-muted-2">
            {active} of {sources.length} active
          </p>
        </div>
        <NewSourceButton />
      </header>

      <div className="rounded-2xl border border-accent-soft/50 bg-accent-soft/15 p-3 text-xs text-foreground/80">
        <strong className="font-semibold">Heads up:</strong> automatic ingestion
        from these sites is coming next. For now, this is where you keep the
        URLs you want monitored — when scraping/import goes live, it&apos;ll
        pull from the sites toggled active here.
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((src) => (
          <SourceRow key={src.id} source={src} />
        ))}
      </ul>

      {sources.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-16 text-center text-muted">
          No sources yet.
        </div>
      )}
    </main>
  );
}

function NewSourceButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<JewelryCategory | "">("");
  const [notes, setNotes] = useState("");
  const addSource = useStore((s) => s.addSource);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    addSource({
      name: name.trim(),
      url: url.trim(),
      category: category || undefined,
      notes: notes.trim() || undefined,
    });
    setName("");
    setUrl("");
    setCategory("");
    setNotes("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium hover:bg-background"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 backdrop-blur-[2px] sm:items-center">
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-t-3xl bg-card p-5 pb-safe shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">Add source</h3>
        <p className="mt-0.5 text-xs text-muted">
          A website or category page to monitor for new arrivals.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mejuri new arrivals"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="URL">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Category (optional)">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as JewelryCategory | "")
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Mixed / not specified</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. check weekly · client X loves their stacking rings"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !url.trim()}
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
          >
            Add source
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function SourceRow({ source }: { source: Source }) {
  const toggle = useStore((s) => s.toggleSourceActive);
  const remove = useStore((s) => s.removeSource);
  const update = useStore((s) => s.updateSource);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(source.notes ?? "");

  const handleDelete = () => {
    if (confirm(`Remove "${source.name}" from sources?`)) remove(source.id);
  };

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            source.active ? "bg-save" : "bg-muted-2"
          }`}
          aria-label={source.active ? "active" : "inactive"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{source.name}</h3>
            {source.category && (
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                {source.category}
              </span>
            )}
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{source.url}</span>
          </a>
          {source.notes && !editingNotes && (
            <p className="mt-1.5 rounded-md bg-background px-2 py-1 text-xs italic text-muted">
              {source.notes}
            </p>
          )}
          {editingNotes && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <button
                onClick={() => {
                  update(source.id, { notes: notes.trim() || undefined });
                  setEditingNotes(false);
                }}
                className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background"
              >
                Save
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button
              onClick={() => toggle(source.id)}
              className={`rounded-full border px-2.5 py-0.5 font-medium ${
                source.active
                  ? "border-save/30 bg-save/10 text-save"
                  : "border-border bg-background text-muted"
              }`}
            >
              {source.active ? "Active" : "Inactive"}
            </button>
            <button
              onClick={() => setEditingNotes((o) => !o)}
              className="text-muted hover:text-foreground"
            >
              {source.notes ? "Edit note" : "Add note"}
            </button>
            <button
              onClick={handleDelete}
              aria-label="Remove source"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-skip hover:bg-background"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
