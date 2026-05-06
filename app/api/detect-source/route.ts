import { NextResponse } from "next/server";
import { detectShopify } from "@/lib/ingest/shopify";

export const runtime = "nodejs";

interface DetectBody {
  url?: unknown;
  retailer?: unknown;
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
  const retailer =
    typeof body.retailer === "string" && body.retailer.trim()
      ? body.retailer.trim()
      : new URL(body.url).host.replace(/^www\./, "");

  const result = await detectShopify(body.url, retailer);
  return NextResponse.json(result);
}
