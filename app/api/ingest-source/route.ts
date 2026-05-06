import { NextResponse } from "next/server";
import { ingestShopify } from "@/lib/ingest/shopify";

export const runtime = "nodejs";

interface IngestBody {
  feedUrl?: unknown;
  retailer?: unknown;
  platform?: unknown;
  windowDays?: unknown;
  limit?: unknown;
}

export async function POST(req: Request) {
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.feedUrl !== "string" || !body.feedUrl.trim()) {
    return NextResponse.json({ ok: false, reason: "Missing feedUrl." }, { status: 400 });
  }
  if (typeof body.retailer !== "string" || !body.retailer.trim()) {
    return NextResponse.json({ ok: false, reason: "Missing retailer." }, { status: 400 });
  }
  if (body.platform !== "shopify") {
    return NextResponse.json(
      { ok: false, reason: "Only Shopify ingestion is supported in v0." },
      { status: 400 },
    );
  }

  const windowDays = clampWindow(body.windowDays);
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.min(body.limit, 250)
      : 250;

  const origin = new URL(body.feedUrl).origin;
  const products = await ingestShopify(body.feedUrl, origin, body.retailer, windowDays, limit);

  return NextResponse.json({
    ok: true,
    productCount: products.length,
    windowDays,
    products,
  });
}

function clampWindow(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.round(n)));
}
