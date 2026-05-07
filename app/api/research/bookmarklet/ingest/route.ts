/**
 * Bookmarklet ingest endpoint. The bookmarklet runs in the user's browser on
 * a third-party retailer page and POSTs here with already-extracted JSON-LD
 * blocks plus OpenGraph meta. We authenticate via a per-user token (session
 * cookies don't work cross-origin) and insert products against the chosen
 * research source.
 *
 * To avoid CORS preflight, the bookmarklet sends Content-Type: text/plain
 * with a JSON body. We handle CORS by setting Access-Control-Allow-Origin: *
 * on every response.
 */

import { NextResponse } from "next/server";
import { extractProductsFromLd, inferCategory } from "@/lib/ingest/research";
import { getSupabaseService } from "@/lib/supabase/service";
import type { ProductInsert } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface BookmarkletBody {
  token?: unknown;
  sourceId?: unknown;
  url?: unknown;
  title?: unknown;
  ldBlocks?: unknown;
  og?: unknown;
  domProducts?: unknown;
}

interface DomProduct {
  title: string;
  productUrl: string;
  imageUrl: string;
  price: number | null;
  priceDisplay: string | null;
}

export async function POST(req: Request) {
  let body: BookmarkletBody;
  try {
    // Bookmarklet sends text/plain to avoid preflight; parse manually.
    const raw = await req.text();
    body = JSON.parse(raw) as BookmarkletBody;
  } catch {
    return cors({ ok: false, reason: "Invalid JSON body." }, 400);
  }

  if (typeof body.token !== "string" || body.token.length < 16) {
    return cors({ ok: false, reason: "Missing or invalid token." }, 401);
  }
  if (typeof body.sourceId !== "string" || !body.sourceId) {
    return cors({ ok: false, reason: "Missing sourceId." }, 400);
  }
  if (typeof body.url !== "string" || !body.url) {
    return cors({ ok: false, reason: "Missing url." }, 400);
  }
  if (!Array.isArray(body.ldBlocks)) {
    return cors({ ok: false, reason: "Missing ldBlocks." }, 400);
  }

  const supabase = getSupabaseService();

  // Validate the token, get the owning user.
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("user_bookmarklet_tokens")
    .select("user_id")
    .eq("token", body.token)
    .maybeSingle();
  if (tokenErr) {
    return cors({ ok: false, reason: "Token lookup failed." }, 500);
  }
  if (!tokenRow) {
    return cors({ ok: false, reason: "Invalid token." }, 401);
  }

  // Verify the source exists and is research-kind. We don't restrict by
  // added_by because research sources are shared; any authenticated user can
  // contribute via bookmarklet.
  const { data: source, error: sourceErr } = await supabase
    .from("sources")
    .select("id, name, kind")
    .eq("id", body.sourceId)
    .maybeSingle();
  if (sourceErr) {
    return cors({ ok: false, reason: "Source lookup failed." }, 500);
  }
  if (!source || source.kind !== "research") {
    return cors({ ok: false, reason: "Source not found or not research-kind." }, 404);
  }

  const og =
    body.og && typeof body.og === "object" && !Array.isArray(body.og)
      ? (body.og as Record<string, string>)
      : {};

  let products = extractProductsFromLd(
    body.ldBlocks,
    og,
    body.url,
    source.name,
  );

  // Fallback to DOM extraction when LD/OG had nothing — many React-rendered
  // catalogs (Grown Brilliance, etc.) only ship Org/Breadcrumb LD on listing
  // pages, with the actual products living in the rendered DOM.
  if (products.length === 0 && Array.isArray(body.domProducts)) {
    products = (body.domProducts as DomProduct[])
      .filter(
        (p) =>
          p &&
          typeof p.productUrl === "string" &&
          p.productUrl &&
          typeof p.title === "string" &&
          p.title,
      )
      .map((p) => ({
        title: p.title.trim(),
        imageUrl: p.imageUrl || "",
        productUrl: p.productUrl,
        retailer: source.name,
        price: typeof p.price === "number" && p.price > 0 ? p.price : undefined,
        priceDisplay: p.priceDisplay ?? undefined,
        category: inferCategory(p.title),
      }));
  }

  if (products.length === 0) {
    return cors(
      {
        ok: true,
        added: 0,
        skipped: 0,
        message: "No products found in this page's data or DOM.",
      },
      200,
    );
  }

  // Dedupe vs already-stored products.
  const urls = products.map((p) => p.productUrl);
  const { data: existing, error: existingErr } = await supabase
    .from("products")
    .select("product_url")
    .in("product_url", urls);
  if (existingErr) {
    return cors({ ok: false, reason: "Dedupe lookup failed." }, 500);
  }
  const existingSet = new Set((existing ?? []).map((r) => r.product_url));

  const fresh = products.filter((p) => !existingSet.has(p.productUrl));
  const skipped = products.length - fresh.length;

  if (fresh.length > 0) {
    const rows: ProductInsert[] = fresh.map((p) => ({
      source_id: source.id,
      title: p.title,
      image_url: p.imageUrl || null,
      additional_images: p.additionalImages ?? [],
      product_url: p.productUrl,
      retailer: p.retailer,
      price: p.price ?? null,
      price_display: p.priceDisplay ?? null,
      category: p.category,
      metal_type: p.metalType ?? null,
      carat_weight: p.caratWeight ?? null,
      stone_type: p.stoneType ?? null,
      source_url: p.sourceUrl ?? null,
    }));
    const { error: insertErr } = await supabase.from("products").insert(rows);
    if (insertErr) {
      return cors({ ok: false, reason: "Insert failed." }, 500);
    }
  }

  await supabase
    .from("sources")
    .update({
      last_ingest_at: new Date().toISOString(),
      last_ingest_count: fresh.length,
    })
    .eq("id", source.id);

  return cors(
    {
      ok: true,
      added: fresh.length,
      skipped,
      message: `Saved ${fresh.length} product${fresh.length === 1 ? "" : "s"}${
        skipped ? ` (${skipped} already in library)` : ""
      } to ${source.name}.`,
    },
    200,
  );
}

function cors(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}
