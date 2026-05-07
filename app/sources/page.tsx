"use client";

import { Calendar, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { SourceOnboarding } from "@/components/SourceOnboarding";
import type { IngestProduct } from "@/lib/ingest/types";
import type { Source } from "@/lib/types";

export default function SourcesPage() {
  const hydrated = useStore((s) => s.hydrated);
  const allSources = useStore((s) => s.sources);
  const sources = [...allSources].sort((a, b) => a.name.localeCompare(b.name));

  if (!hydrated) {
    return <main className="flex flex-1 items-center justify-center px-6 pt-safe" />;
  }

  const active = sources.filter((s) => s.active).length;
  const ingestable = sources.filter((s) => s.platform === "shopify").length;

  return (
    <main className="flex flex-1 flex-col px-4 pt-safe pb-4">
      <header className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sources</h1>
          <p className="text-xs text-muted-2">
            {active} of {sources.length} active · {ingestable} auto-ingestable
          </p>
        </div>
        <SourceOnboarding />
      </header>

      <ul className="mt-1 flex flex-col gap-2">
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

function SourceRow({ source }: { source: Source }) {
  const toggle = useStore((s) => s.toggleSourceActive);
  const remove = useStore((s) => s.removeSource);
  const update = useStore((s) => s.updateSource);
  const addIngestedProducts = useStore((s) => s.addIngestedProducts);
  const userId = useStore((s) => s.userId);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(source.notes ?? "");
  const [editingWindow, setEditingWindow] = useState(false);
  const [windowDraft, setWindowDraft] = useState(source.freshnessWindowDays ?? 30);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<string | null>(null);

  const canIngest = source.platform === "shopify" && !!source.feedUrl;
  const windowDays = source.freshnessWindowDays ?? 30;
  // Only the user who originally onboarded this source can edit/delete it.
  // Sources with a null addedBy (creator deleted) are immutable until an
  // admin cleans them up. Pulling is allowed for any authenticated user.
  const isOwner = !!userId && source.addedBy === userId;

  const handleDelete = () => {
    if (confirm(`Remove "${source.name}" from sources?`)) remove(source.id);
  };

  const handlePull = async () => {
    if (!canIngest || !source.feedUrl) return;
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/ingest-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedUrl: source.feedUrl,
          retailer: source.name,
          platform: source.platform,
          windowDays,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; products: IngestProduct[] }
        | { ok: false; reason: string };
      if (!data.ok) {
        setPullResult(`Failed: ${data.reason}`);
      } else {
        const { added, skipped } = await addIngestedProducts(
          source.id,
          source.name,
          data.products,
        );
        setPullResult(
          added === 0
            ? `Up to date — ${skipped} already in your library`
            : `Added ${added} new product${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already in library` : ""}`,
        );
      }
    } catch (e) {
      setPullResult(
        e instanceof Error ? `Failed: ${e.message}` : "Failed: network error",
      );
    } finally {
      setPulling(false);
    }
  };

  const platformLabel = source.platform
    ? source.platform === "shopify"
      ? "Shopify"
      : source.platform === "custom"
        ? "Custom"
        : "Unknown"
    : "Unknown";

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
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                source.platform === "shopify"
                  ? "bg-save/10 text-save"
                  : "bg-background text-muted"
              }`}
            >
              {platformLabel}
            </span>
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

          {source.feedUrl && source.feedUrl !== source.url && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-2">
              feed: {source.feedUrl}
            </p>
          )}

          {source.lastIngestAt && (
            <p className="mt-0.5 text-[11px] text-muted-2">
              Last pull: {new Date(source.lastIngestAt).toLocaleString()} ·{" "}
              {source.lastIngestCount ?? 0} new
            </p>
          )}

          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-2">
            {isOwner ? "Added by you" : source.addedBy ? "Added by teammate" : "Shared"}
          </p>

          {pullResult && (
            <p
              className={`mt-1.5 rounded-md px-2 py-1 text-xs ${
                pullResult.startsWith("Failed")
                  ? "bg-skip/10 text-skip"
                  : "bg-save/10 text-save"
              }`}
            >
              {pullResult}
            </p>
          )}

          {source.notes && !editingNotes && (
            <p className="mt-1.5 rounded-md bg-background px-2 py-1 text-xs italic text-muted">
              {source.notes}
            </p>
          )}
          {editingNotes && isOwner && (
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

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {isOwner ? (
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
            ) : (
              <span
                className={`rounded-full border px-2.5 py-0.5 font-medium ${
                  source.active
                    ? "border-save/30 bg-save/10 text-save"
                    : "border-border bg-background text-muted"
                }`}
              >
                {source.active ? "Active" : "Inactive"}
              </span>
            )}
            {canIngest && (
              <button
                onClick={handlePull}
                disabled={pulling}
                className="flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground px-2.5 py-0.5 font-medium text-background disabled:opacity-50"
              >
                {pulling ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Pulling…
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Pull last {windowDays}d
                  </>
                )}
              </button>
            )}
            {isOwner && !editingWindow && (
              <button
                onClick={() => {
                  setWindowDraft(windowDays);
                  setEditingWindow(true);
                }}
                className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 font-medium text-muted hover:text-foreground"
              >
                <Calendar className="h-3 w-3" />
                {windowDays}d window
              </button>
            )}
            {isOwner && editingWindow && (
              <span className="flex items-center gap-1 rounded-full border border-accent bg-card px-2 py-0.5">
                <Calendar className="h-3 w-3 text-muted" />
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={windowDraft}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) setWindowDraft(n);
                  }}
                  autoFocus
                  className="w-12 bg-transparent text-xs font-medium outline-none"
                />
                <span className="text-muted-2">d</span>
                <button
                  onClick={() => {
                    const clamped = Math.max(1, Math.min(365, windowDraft));
                    update(source.id, { freshnessWindowDays: clamped });
                    setEditingWindow(false);
                  }}
                  className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background"
                >
                  Save
                </button>
              </span>
            )}
            {!isOwner && (
              <span className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 font-medium text-muted">
                <Calendar className="h-3 w-3" />
                {windowDays}d window
              </span>
            )}
            {isOwner && (
              <button
                onClick={() => setEditingNotes((o) => !o)}
                className="text-muted hover:text-foreground"
              >
                {source.notes ? "Edit note" : "Add note"}
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDelete}
                aria-label="Remove source"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-skip hover:bg-background"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
