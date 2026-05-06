"use client";

import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/categories";
import type { DetectionResult, IngestProduct } from "@/lib/ingest/types";
import type { JewelryCategory } from "@/lib/types";

type Step = "form" | "detecting" | "preview" | "fallback";

export function SourceOnboarding() {
  const addSource = useStore((s) => s.addSource);
  const addIngestedProducts = useStore((s) => s.addIngestedProducts);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [category, setCategory] = useState<JewelryCategory | "">("");
  const [notes, setNotes] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("form");
    setName("");
    setUrl("");
    setWindowDays(30);
    setCategory("");
    setNotes("");
    setDetection(null);
    setError(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const detect = async (overrideWindowDays?: number) => {
    setStep("detecting");
    setError(null);
    try {
      const res = await fetch("/api/detect-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          retailer: name.trim() || undefined,
          windowDays: overrideWindowDays ?? windowDays,
        }),
      });
      const data = (await res.json()) as DetectionResult;
      setDetection(data);
      setStep(data.ok ? "preview" : "fallback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStep("fallback");
    }
  };

  const saveAndIngest = async () => {
    if (!detection?.ok) return;
    const effectiveWindow = detection.windowDays;
    const sourceId = addSource({
      name: name.trim(),
      url: url.trim(),
      feedUrl: detection.feedUrl,
      platform: detection.platform,
      freshnessWindowDays: effectiveWindow,
      category: category || undefined,
      notes: notes.trim() || undefined,
    });
    if (detection.inWindowCount > 0) {
      try {
        const res = await fetch("/api/ingest-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedUrl: detection.feedUrl,
            retailer: name.trim(),
            platform: detection.platform,
            windowDays: effectiveWindow,
          }),
        });
        const data = (await res.json()) as
          | { ok: true; products: IngestProduct[] }
          | { ok: false; reason: string };
        if (data.ok) {
          addIngestedProducts(sourceId, name.trim(), data.products);
        }
      } catch {
        // If full ingest fails, at least the samples seeded the source.
        addIngestedProducts(sourceId, name.trim(), detection.samples);
      }
    }
    close();
  };

  const saveWithoutIngest = () => {
    addSource({
      name: name.trim(),
      url: url.trim(),
      platform: "unknown",
      freshnessWindowDays: windowDays,
      category: category || undefined,
      notes: notes.trim() || undefined,
    });
    close();
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
      <div className="relative w-full max-w-md rounded-t-3xl bg-card p-5 pb-safe shadow-2xl sm:rounded-3xl">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
        >
          <X className="h-5 w-5" />
        </button>

        {step === "form" && (
          <FormStep
            name={name}
            url={url}
            windowDays={windowDays}
            category={category}
            notes={notes}
            onName={setName}
            onUrl={setUrl}
            onWindowDays={setWindowDays}
            onCategory={setCategory}
            onNotes={setNotes}
            onSubmit={() => detect()}
            onCancel={close}
          />
        )}

        {step === "detecting" && <DetectingStep url={url} />}

        {step === "preview" && detection?.ok && (
          <PreviewStep
            detection={detection}
            onConfirm={saveAndIngest}
            onChangeWindow={(d) => {
              setWindowDays(d);
              detect(d);
            }}
            onTryAgain={() => setStep("form")}
          />
        )}

        {step === "fallback" && (
          <FallbackStep
            reason={
              error ??
              (detection && !detection.ok
                ? detection.reason
                : "Something went wrong.")
            }
            onTryAgain={() => setStep("form")}
            onSaveAnyway={saveWithoutIngest}
          />
        )}
      </div>
    </div>
  );
}

function FormStep({
  name,
  url,
  windowDays,
  category,
  notes,
  onName,
  onUrl,
  onWindowDays,
  onCategory,
  onNotes,
  onSubmit,
  onCancel,
}: {
  name: string;
  url: string;
  windowDays: number;
  category: JewelryCategory | "";
  notes: string;
  onName: (v: string) => void;
  onUrl: (v: string) => void;
  onWindowDays: (v: number) => void;
  onCategory: (v: JewelryCategory | "") => void;
  onNotes: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const ready = name.trim() && url.trim();
  const presets = [7, 14, 30, 60, 90, 180];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
    >
      <h3 className="text-base font-semibold">Add a source</h3>
      <p className="mt-0.5 text-xs text-muted">
        Paste the new-arrivals URL of a jewelry site. We&apos;ll probe it and
        show you what we can pull.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <Field label="Retailer name">
          <input
            autoFocus
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Aurate New York"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="URL">
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://auratenewyork.com/collections/new"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </Field>
        <Field
          label="Freshness window"
          hint="Only ingest products published in the last N days. Set higher for slow-publishing boutiques."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={windowDays}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) onWindowDays(Math.max(1, Math.min(365, n)));
              }}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">days</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {presets.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => onWindowDays(d)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                  windowDays === d
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </Field>

        <Field label="Category (optional)">
          <select
            value={category}
            onChange={(e) => onCategory(e.target.value as JewelryCategory | "")}
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
            onChange={(e) => onNotes(e.target.value)}
            placeholder="e.g. check weekly · client X loves them"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
        >
          Detect
        </button>
      </div>
    </form>
  );
}

function DetectingStep({ url }: { url: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <h3 className="text-base font-semibold">Probing the site</h3>
      <p className="text-xs text-muted break-all">{url}</p>
      <p className="text-xs text-muted-2">
        Trying common new-arrival URLs. Usually takes a couple seconds.
      </p>
    </div>
  );
}

function PreviewStep({
  detection,
  onConfirm,
  onChangeWindow,
  onTryAgain,
}: {
  detection: Extract<DetectionResult, { ok: true }>;
  onConfirm: () => void;
  onChangeWindow: (days: number) => void;
  onTryAgain: () => void;
}) {
  const presets = [7, 14, 30, 60, 90, 180];
  const noneInWindow = detection.inWindowCount === 0;

  return (
    <div>
      <div className="flex items-start gap-3">
        <CheckCircle2
          className={`mt-0.5 h-6 w-6 shrink-0 ${noneInWindow ? "text-muted-2" : "text-save"}`}
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            {noneInWindow ? "Feed found, no recent products" : "Looks good"}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            <strong>{detection.inWindowCount}</strong> in last{" "}
            <strong>{detection.windowDays} days</strong> ·{" "}
            <span className="text-muted-2">
              {detection.totalCount} total in feed
            </span>{" "}
            ·{" "}
            <span className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">
              {detection.platform}
            </span>
          </p>
          <p className="mt-0.5 break-all text-[11px] text-muted-2">
            {detection.feedUrl}
          </p>
        </div>
      </div>

      {/* Window override */}
      <div className="mt-4 rounded-2xl border border-border bg-background p-3">
        <p className="text-[11px] font-medium text-muted">
          Adjust the window
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {presets.map((d) => (
            <button
              key={d}
              onClick={() => onChangeWindow(d)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                detection.windowDays === d
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {detection.samples.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">
            Sample of what we&apos;ll pull
          </p>
          <div className="grid grid-cols-3 gap-2">
            {detection.samples.slice(0, 6).map((p, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-border bg-background"
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="h-24 w-full object-cover"
                  />
                )}
                <div className="p-1.5">
                  <p className="truncate text-[10px] font-medium leading-tight">
                    {p.title}
                  </p>
                  {p.priceDisplay && (
                    <p className="text-[10px] text-muted">{p.priceDisplay}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onTryAgain}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
        >
          Try a different URL
        </button>
        <button
          onClick={onConfirm}
          disabled={noneInWindow}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
        >
          {noneInWindow ? "Save without products" : "Add and pull"}
        </button>
      </div>
    </div>
  );
}

function FallbackStep({
  reason,
  onTryAgain,
  onSaveAnyway,
}: {
  reason: string;
  onTryAgain: () => void;
  onSaveAnyway: () => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold">Auto-detect didn&apos;t work</h3>
      <p className="mt-1 text-xs text-muted">{reason}</p>
      <p className="mt-3 rounded-2xl border border-accent-soft/50 bg-accent-soft/15 p-3 text-xs">
        <strong>What this means:</strong> we couldn&apos;t find a public product
        feed at this URL. The site may be on a custom platform — we&apos;ll
        build a dedicated adapter for it later. You can still save it as a
        source for tracking now.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onTryAgain}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium"
        >
          Try a different URL
        </button>
        <button
          onClick={onSaveAnyway}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
        >
          Save without ingestion
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-2">{hint}</span>}
    </label>
  );
}
