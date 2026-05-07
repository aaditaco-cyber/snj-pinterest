"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Bookmark,
  Download,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import { BookmarkletGenerator } from "@/components/BookmarkletGenerator";
import type { JewelryCategory, Source } from "@/lib/types";

/**
 * Sheet for managing research sources: list existing ones, refresh / delete,
 * and add new sources via a multi-page input. Shown only when user clicks
 * "Edit sources" on /research.
 */
export function ResearchSourceSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const userId = useStore((s) => s.userId);
  const allSources = useStore((s) => s.sources);
  const sources = allSources
    .filter((s) => s.kind === "research")
    .sort((a, b) => a.name.localeCompare(b.name));

  const removeSource = useStore((s) => s.removeSource);
  const ingest = useStore((s) => s.ingestResearchSource);

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resultById, setResultById] = useState<Record<string, string>>({});
  const [bookmarkletSource, setBookmarkletSource] = useState<Source | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleRefresh = async (sourceId: string) => {
    setBusyId(sourceId);
    setResultById((r) => ({ ...r, [sourceId]: "" }));
    const r = await ingest(sourceId);
    setBusyId(null);
    setResultById((prev) => ({
      ...prev,
      [sourceId]: r.reason
        ? `Failed: ${r.reason}`
        : r.added === 0
          ? `Up to date — ${r.skipped} already in library`
          : `Added ${r.added}${r.skipped ? `, ${r.skipped} already in library` : ""}`,
    }));
  };

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl pb-safe"
          >
            <div className="mx-auto mt-2.5 flex h-1.5 w-10 items-center justify-center rounded-full bg-border" />

            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div>
                <h3 className="text-base font-semibold">Research sources</h3>
                <p className="text-xs text-muted-2">
                  {sources.length} source{sources.length === 1 ? "" : "s"} ·
                  shared across the team
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6">
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-background py-3 text-sm font-medium text-muted hover:bg-foreground/[0.03] hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add a research source
                </button>
              )}
              {adding && (
                <AddResearchSourceForm
                  onCancel={() => setAdding(false)}
                  onAdded={() => setAdding(false)}
                />
              )}

              <ul className="flex flex-col gap-2">
                {sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    isOwner={!!userId && source.addedBy === userId}
                    busy={busyId === source.id}
                    result={resultById[source.id] ?? ""}
                    onRefresh={() => handleRefresh(source.id)}
                    onBookmarklet={() => setBookmarkletSource(source)}
                    onDelete={() => {
                      if (confirm(`Remove "${source.name}"?`)) {
                        removeSource(source.id);
                      }
                    }}
                  />
                ))}
              </ul>

              {sources.length === 0 && !adding && (
                <p className="py-8 text-center text-xs text-muted-2">
                  No research sources yet. Tap above to add one.
                </p>
              )}
            </div>
          </motion.div>
          <BookmarkletGenerator
            source={bookmarkletSource}
            onClose={() => setBookmarkletSource(null)}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function SourceRow({
  source,
  isOwner,
  busy,
  result,
  onRefresh,
  onBookmarklet,
  onDelete,
}: {
  source: Source;
  isOwner: boolean;
  busy: boolean;
  result: string;
  onRefresh: () => void;
  onBookmarklet: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-2xl border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold">{source.name}</h4>
          <p className="mt-0.5 text-[11px] text-muted-2">
            {source.pages?.length ?? 0} page
            {(source.pages?.length ?? 0) === 1 ? "" : "s"}
            {source.lastIngestAt && (
              <>
                {" · last pulled "}
                {new Date(source.lastIngestAt).toLocaleDateString()}
              </>
            )}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {source.pages?.slice(0, 3).map((p) => (
              <li
                key={p}
                className="truncate font-mono text-[10px] text-muted-2"
              >
                {p}
              </li>
            ))}
            {(source.pages?.length ?? 0) > 3 && (
              <li className="text-[10px] text-muted-2">
                + {(source.pages?.length ?? 0) - 3} more
              </li>
            )}
          </ul>
          {result && (
            <p
              className={`mt-1.5 rounded-md px-2 py-1 text-[11px] ${
                result.startsWith("Failed")
                  ? "bg-skip/10 text-skip"
                  : "bg-save/10 text-save"
              }`}
            >
              {result}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={onRefresh}
            disabled={busy}
            className="flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground px-2.5 py-1 text-[11px] font-medium text-background disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Pulling
              </>
            ) : (
              <>
                <Download className="h-3 w-3" />
                Refresh
              </>
            )}
          </button>
          <button
            onClick={onBookmarklet}
            title="For sites we can't scrape — runs in your browser"
            className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted hover:text-foreground"
          >
            <Bookmark className="h-3 w-3" />
            Bookmarklet
          </button>
          {isOwner && (
            <button
              onClick={onDelete}
              aria-label="Remove source"
              className="flex h-7 w-7 items-center justify-center rounded-full text-skip hover:bg-card"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

interface ProbePageResult {
  url: string;
  ok: boolean;
  count: number;
  source: string;
  reason?: string;
}

function AddResearchSourceForm({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: () => void;
}) {
  const addResearchSource = useStore((s) => s.addResearchSource);
  const ingest = useStore((s) => s.ingestResearchSource);

  const [name, setName] = useState("");
  const [pagesText, setPagesText] = useState("");
  const [category, setCategory] = useState<JewelryCategory | "">("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "probing" | "preview">("form");
  const [saving, setSaving] = useState(false);
  const [probeResults, setProbeResults] = useState<ProbePageResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pages = pagesText
    .split(/\r?\n|,/)
    .map((p) => p.trim())
    .filter(Boolean);

  const handleProbe = async () => {
    if (!name.trim() || pages.length === 0) return;
    setStep("probing");
    setError(null);
    try {
      const res = await fetch("/api/research/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, retailer: name.trim() }),
      });
      const data = (await res.json()) as
        | { ok: true; results: ProbePageResult[] }
        | { ok: false; reason: string };
      if (!data.ok) {
        setError(data.reason);
        setStep("form");
        return;
      }
      setProbeResults(data.results);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStep("form");
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    const sourceId = await addResearchSource({
      name: name.trim(),
      pages,
      category: category || undefined,
      notes: notes.trim() || undefined,
    });
    if (!sourceId) {
      setError(
        "Couldn't add this source — check the console. The first page URL might already be in use.",
      );
      setSaving(false);
      return;
    }
    await ingest(sourceId);
    setSaving(false);
    onAdded();
  };

  if (step === "probing") {
    return (
      <div className="mb-3 flex flex-col items-center gap-2 rounded-2xl border border-border bg-background py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <p className="text-xs font-medium">Probing pages…</p>
      </div>
    );
  }

  if (step === "preview") {
    const totalCount = probeResults.reduce((acc, r) => acc + r.count, 0);
    const okCount = probeResults.filter((r) => r.ok).length;
    return (
      <div className="mb-3 rounded-2xl border border-border bg-background p-3">
        <p className="text-xs font-medium">
          {okCount}/{probeResults.length} pages worked · {totalCount} products
          found
        </p>
        <ul className="mt-2 space-y-1">
          {probeResults.map((r) => (
            <li key={r.url} className="text-[11px]">
              <span
                className={`mr-1.5 rounded-full px-1.5 py-0.5 font-medium uppercase tracking-wide ${
                  r.ok
                    ? "bg-save/10 text-save"
                    : "bg-skip/10 text-skip"
                }`}
              >
                {r.ok ? `${r.count}` : "0"}
              </span>
              <span className="font-mono text-muted">{r.url}</span>
              {!r.ok && r.reason && (
                <span className="ml-1 text-muted-2">— {r.reason}</span>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p className="mt-2 rounded-md bg-skip/10 px-2 py-1 text-[11px] text-skip">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => setStep("form")}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
          >
            Edit
          </button>
          <button
            onClick={handleConfirm}
            disabled={okCount === 0 || saving}
            className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? "Adding…" : "Add and pull"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleProbe();
      }}
      className="mb-3 rounded-2xl border border-border bg-background p-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">New research source</h4>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blue Nile · Best sellers"
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">
            Page URLs (one per line)
          </span>
          <textarea
            value={pagesText}
            onChange={(e) => setPagesText(e.target.value)}
            rows={4}
            placeholder={"https://www.bluenile.com/best-sellers/jewelry\nhttps://www.bluenile.com/jewelry/necklaces"}
            className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
          />
          {pages.length > 0 && (
            <span className="text-[10px] text-muted-2">
              {pages.length} URL{pages.length === 1 ? "" : "s"} ready to probe
            </span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Category</span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as JewelryCategory | "")
              }
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Mixed</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">
              Notes (optional)
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-skip/10 px-2 py-1 text-[11px] text-skip">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || pages.length === 0}
          className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-40"
        >
          Probe
        </button>
      </div>
    </form>
  );
}
