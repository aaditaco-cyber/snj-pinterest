import { NextResponse } from "next/server";
import { probeResearchPage } from "@/lib/ingest/research";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ProbeBody {
  pages?: unknown;
  retailer?: unknown;
}

/** Probe each provided page URL, return per-page sample + count. */
export async function POST(req: Request) {
  let body: ProbeBody;
  try {
    body = (await req.json()) as ProbeBody;
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

  // Probe all pages in parallel; downstream UI can show per-page status.
  const results = await Promise.all(
    urls.map((url) => probeResearchPage(url, retailer)),
  );

  return NextResponse.json({ ok: true, results });
}

function safeRetailerFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
