"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Printer, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { FolderItem, Product } from "@/lib/types";

export default function LookbookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const userEmail = useStore((s) => s.userEmail);
  const folders = useStore((s) => s.folders);
  const folder = folders.find((f) => f.id === params.id);
  const allFolderItems = useStore((s) => s.folderItems);
  const allProducts = useStore((s) => s.products);

  const items = useMemo(
    () =>
      allFolderItems
        .filter((fi) => fi.folderId === params.id)
        .sort(
          (a, b) =>
            new Date(b.dateAdded).getTime() -
            new Date(a.dateAdded).getTime(),
        ),
    [allFolderItems, params.id],
  );

  const productsById = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );

  const products = useMemo(
    () =>
      items
        .map((it) => {
          const p = productsById.get(it.productId);
          return p ? { item: it, product: p } : null;
        })
        .filter((x): x is { item: FolderItem; product: Product } => x !== null),
    [items, productsById],
  );

  const today = new Date();
  const defaultRef = `SNJ-${today.toISOString().slice(2, 10).replace(/-/g, "")}-${(folder?.id ?? "").slice(0, 4).toUpperCase()}`;

  const [client, setClient] = useState("");
  const [curator, setCurator] = useState(
    userEmail ? userEmail.split("@")[0].replace(/\b\w/g, (c) => c.toUpperCase()) : "SNJ",
  );
  const [intro, setIntro] = useState("");
  const [refNumber, setRefNumber] = useState(defaultRef);
  const [editorOpen, setEditorOpen] = useState(true);

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

  // Stats
  const prices = products
    .map((p) => p.product.price)
    .filter((n): n is number => typeof n === "number");
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const categoryCounts = products.reduce<Record<string, number>>(
    (acc, p) => {
      const k = p.product.category;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Pair products into spreads of 2
  const spreads: { item: FolderItem; product: Product }[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    spreads.push(products.slice(i, i + 2));
  }

  return (
    <div className="lookbook-root bg-background text-foreground">
      {/* On-screen toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-center justify-between gap-3 bg-background/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push(`/folders/${folder.id}`)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {editorOpen ? "Hide editor" : "Edit cover"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Editor panel */}
      {editorOpen && (
        <div className="no-print mx-auto w-full max-w-3xl px-4 pb-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Cover details
            </p>
            <p className="mt-0.5 text-xs text-muted-2">
              These appear on the cover page only. Hidden when you print.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Client">
                <input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Bloomingdale's"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </Field>
              <Field label="Curator name">
                <input
                  value={curator}
                  onChange={(e) => setCurator(e.target.value)}
                  placeholder="Your name or SNJ"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </Field>
              <Field label="Reference">
                <input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent font-mono"
                />
              </Field>
              <Field label="Date" className="opacity-60">
                <input
                  value={today.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  disabled
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Curator's intro (optional, 1–3 sentences)">
                  <textarea
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    placeholder="These twelve pieces from this week's drops fit your fall collection's gold-vermeil leaning. Notable: three under $300 retail, all bridal-adjacent."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lookbook itself */}
      <article className="lookbook mx-auto w-full max-w-3xl bg-card shadow-2xl print:max-w-none print:shadow-none">
        {/* Cover page */}
        <section className="lb-page lb-cover">
          <header className="lb-cover-header">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
              {today
                .toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
              · {refNumber}
            </div>
            <Monogram />
          </header>

          <div className="lb-cover-body">
            <p className="lb-eyebrow">Lookbook</p>
            <h1 className="lb-title">{folder.name}</h1>
            {client.trim() && (
              <p className="lb-curated">
                Curated for <span className="lb-client">{client}</span>
              </p>
            )}
            {intro.trim() && <p className="lb-intro">{intro}</p>}
          </div>

          <footer className="lb-cover-footer">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Selection
              </p>
              <p className="text-sm font-medium">
                {products.length} {products.length === 1 ? "piece" : "pieces"}
                {minPrice !== null && maxPrice !== null && (
                  <>
                    {" · "}
                    {fmtUSD(minPrice)}–{fmtUSD(maxPrice)}
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Curated by
              </p>
              <p className="text-sm font-medium">{curator}</p>
            </div>
          </footer>
        </section>

        {/* Product spreads */}
        {spreads.map((spread, spreadIdx) => (
          <section className="lb-page lb-spread" key={spreadIdx}>
            {spread.map((entry, i) => {
              const lookNumber = spreadIdx * 2 + i + 1;
              return (
                <Look
                  key={entry.item.id}
                  number={lookNumber}
                  item={entry.item}
                  product={entry.product}
                />
              );
            })}
            {/* If only one product on this spread, fill the bottom half with negative space */}
            {spread.length === 1 && <div className="lb-look-empty" />}
          </section>
        ))}

        {/* Closing page */}
        <section className="lb-page lb-close">
          <div className="lb-close-body">
            <p className="lb-eyebrow">Summary</p>
            <h2 className="lb-close-title">{folder.name}</h2>

            <dl className="lb-stats">
              <div>
                <dt>Pieces</dt>
                <dd>{products.length}</dd>
              </div>
              {minPrice !== null && maxPrice !== null && (
                <div>
                  <dt>Price range</dt>
                  <dd>
                    {fmtUSD(minPrice)} – {fmtUSD(maxPrice)}
                  </dd>
                </div>
              )}
              <div>
                <dt>Categories</dt>
                <dd>
                  {Object.entries(categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(
                      ([k, n]) =>
                        `${CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k} (${n})`,
                    )
                    .join(" · ")}
                </dd>
              </div>
            </dl>

            <div className="lb-divider" />

            <p className="lb-eyebrow">Next steps</p>
            <p className="lb-contact">
              Reach out to <strong>{curator}</strong>
              {userEmail && (
                <>
                  {" at "}
                  <a href={`mailto:${userEmail}`}>{userEmail}</a>
                </>
              )}{" "}
              to discuss any of these pieces — pricing, availability, or to
              request additional looks in this direction.
            </p>
          </div>

          <footer className="lb-cover-footer">
            <Monogram small />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {refNumber}
              </p>
            </div>
          </footer>
        </section>
      </article>

      <style jsx global>{`
        @page {
          size: letter;
          margin: 0.5in 0.6in;
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .lookbook-root {
            background: white;
          }
          .lookbook {
            box-shadow: none !important;
          }
          .lb-page {
            break-after: page;
            page-break-after: always;
          }
          .lb-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          a {
            color: inherit !important;
            text-decoration: none !important;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .lookbook {
          font-family: var(--font-sans);
          color: var(--foreground);
        }
        .lb-page {
          padding: 3rem 2.5rem;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        @media print {
          .lb-page {
            padding: 0;
            min-height: calc(11in - 1in);
          }
        }
        .lb-cover {
          justify-content: space-between;
        }
        .lb-cover-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }
        .lb-cover-body {
          padding: 4rem 0;
        }
        .lb-cover-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
        }
        .lb-eyebrow {
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 0.5rem 0;
        }
        .lb-title {
          font-family: var(--font-serif);
          font-weight: 600;
          font-size: clamp(2.75rem, 6vw, 4.25rem);
          line-height: 1.05;
          letter-spacing: -0.01em;
          margin: 0;
        }
        .lb-curated {
          margin: 1.25rem 0 0 0;
          font-size: 1rem;
          color: var(--muted);
        }
        .lb-client {
          font-family: var(--font-serif);
          font-style: italic;
          color: var(--foreground);
          font-size: 1.35rem;
        }
        .lb-intro {
          margin: 2rem 0 0 0;
          font-size: 1rem;
          line-height: 1.55;
          max-width: 38ch;
          color: var(--foreground);
        }

        /* Spread page (2 products) */
        .lb-spread {
          gap: 2.5rem;
        }
        .lb-look {
          display: grid;
          grid-template-columns: 5fr 6fr;
          gap: 1.75rem;
          flex: 1;
          min-height: 0;
        }
        .lb-look-empty {
          flex: 1;
        }
        .lb-look-image {
          aspect-ratio: 1 / 1;
          background: var(--background);
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .lb-look-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .lb-look-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .lb-look-num {
          font-family: var(--font-serif);
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--accent);
          text-transform: uppercase;
        }
        .lb-look-retailer {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--muted-2);
        }
        .lb-look-title {
          font-family: var(--font-serif);
          font-size: 1.4rem;
          font-weight: 600;
          line-height: 1.2;
          margin: 0;
        }
        .lb-look-price {
          font-size: 1.15rem;
          font-weight: 600;
          margin-top: 0.1rem;
        }
        .lb-look-specs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.5rem;
        }
        .lb-look-specs span {
          font-size: 10px;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--foreground);
        }
        .lb-look-note {
          margin-top: 0.5rem;
          font-size: 13px;
          line-height: 1.5;
          font-style: italic;
          color: var(--muted);
          border-left: 2px solid var(--accent-soft);
          padding-left: 0.75rem;
        }
        .lb-look-link {
          margin-top: auto;
          font-size: 10px;
          color: var(--muted-2);
          word-break: break-all;
          font-family: ui-monospace, monospace;
        }

        /* Closing page */
        .lb-close {
          justify-content: space-between;
        }
        .lb-close-body {
          padding-top: 2rem;
        }
        .lb-close-title {
          font-family: var(--font-serif);
          font-size: 2.25rem;
          font-weight: 600;
          line-height: 1.1;
          margin: 0 0 1.75rem 0;
        }
        .lb-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
        }
        .lb-stats > div {
          display: grid;
          grid-template-columns: 9rem 1fr;
          gap: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border);
        }
        .lb-stats dt {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--muted);
          padding-top: 0.15rem;
        }
        .lb-stats dd {
          font-size: 1rem;
          margin: 0;
        }
        .lb-divider {
          height: 1px;
          background: var(--border);
          margin: 2rem 0 1.75rem 0;
        }
        .lb-contact {
          font-size: 1rem;
          line-height: 1.6;
          max-width: 38ch;
          color: var(--foreground);
        }
        .lb-contact a {
          color: var(--accent);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

function Look({
  number,
  item,
  product,
}: {
  number: number;
  item: FolderItem;
  product: Product;
}) {
  const looksLabel = `Look ${String(number).padStart(2, "0")}`;
  return (
    <div className="lb-look">
      <div className="lb-look-image">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.title} />
        )}
      </div>
      <div className="lb-look-info">
        <div className="flex items-baseline justify-between gap-2">
          <span className="lb-look-num">{looksLabel}</span>
          <span className="lb-look-retailer">{product.retailer}</span>
        </div>
        <h3 className="lb-look-title">{product.title}</h3>
        {product.priceDisplay && (
          <p className="lb-look-price">{product.priceDisplay}</p>
        )}
        <div className="lb-look-specs">
          <span>{CATEGORY_LABEL[product.category]}</span>
          {product.metalType && <span>{product.metalType}</span>}
          {product.caratWeight && <span>{product.caratWeight}</span>}
          {product.stoneType && <span>{product.stoneType}</span>}
        </div>
        {item.notes && <p className="lb-look-note">{item.notes}</p>}
        <div className="lb-look-link">
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {product.productUrl}
          </span>
        </div>
      </div>
    </div>
  );
}

function Monogram({ small = false }: { small?: boolean }) {
  const size = small ? 28 : 44;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="SNJ">
      <rect width="64" height="64" rx="14" fill="#1a1614" />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="36"
        fontWeight="700"
        fill="#b08d57"
      >
        S
      </text>
    </svg>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function fmtUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
