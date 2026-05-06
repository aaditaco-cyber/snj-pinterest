import { NextResponse } from "next/server";
import { detectShopify } from "@/lib/ingest/shopify";

export const runtime = "nodejs";

interface DetectBody {
  url?: unknown;
  retailer?: unknown;
  windowDays?: unknown;
}

export async function POST(req: Request) {
  let body: DetectBody;
  try {
    body = (await req.json()) as DetectBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ ok: false, reason: "Missing url." }, { status: 400 });
  }

  let retailer: string;
  try {
    retailer =
      typeof body.retailer === "string" && body.retailer.trim()
        ? body.retailer.trim()
        : new URL(body.url).host.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid url." }, { status: 400 });
  }

  const windowDays = clampWindow(body.windowDays);
  const result = await detectShopify(body.url, retailer, windowDays);
  return NextResponse.json(result);
}

function clampWindow(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.round(n)));
}
