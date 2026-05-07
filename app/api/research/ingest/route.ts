import { NextResponse } from "next/server";
import { scrapeResearchPage } from "@/lib/ingest/research";
import type { IngestProduct } from "@/lib/ingest/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IngestBody {
  pages?: unknown;
  retailer?: unknown;
}

/**
 * Scrape every provided page and return the union of products (deduped by
 * productUrl across pages). Inserts happen client-side via repo.ingestProducts
 * so RLS still applies and we share one code path with discover.
 */
export async function POST(req: Request) {
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "Missing pages." },
      { status: 400 },
    );
  }

  const urls = body.pages
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "No valid page URLs." },
      { status: 400 },
    );
  }

  const retailer =
    typeof body.retailer === "string" && body.retailer.trim()
      ? body.retailer.trim()
      : safeRetailerFromUrl(urls[0]);

  const seen = new Set<string>();
  const products: IngestProduct[] = [];
  // Sequential (not parallel) — sites occasionally rate-limit, and the few-
  // seconds added latency keeps us polite.
  for (const url of urls) {
    const scraped = await scrapeResearchPage(url, retailer);
    for (const p of scraped) {
      if (!p.productUrl || seen.has(p.productUrl)) continue;
      seen.add(p.productUrl);
      // Strip the internal _source marker before sending to the client.
      const { _source: _omit, ...clean } = p;
      void _omit;
      products.push(clean);
    }
  }

  return NextResponse.json({
    ok: true,
    productCount: products.length,
    products,
  });
}

function safeRetailerFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
