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
import type { ProductInsert, ProductUpdate } from "@/lib/supabase/database.types";

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
  caratWeight: string | null;
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
        caratWeight: p.caratWeight ?? undefined,
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

  // Dedupe vs already-stored products. Pull existing fields too so we can
  // back-fill missing ones on re-scrape (e.g. carat extracted in a later
  // bookmarklet version that the original ingest didn't have).
  const urls = products.map((p) => p.productUrl);
  const { data: existing, error: existingErr } = await supabase
    .from("products")
    .select(
      "id, product_url, category, carat_weight, image_url, price, price_display, metal_type, stone_type",
    )
    .in("product_url", urls);
  if (existingErr) {
    return cors({ ok: false, reason: "Dedupe lookup failed." }, 500);
  }
  const existingMap = new Map(
    (existing ?? []).map((r) => [r.product_url, r] as const),
  );

  type Update = { id: string; patch: ProductUpdate };
  const fresh: typeof products = [];
  const updates: Update[] = [];
  for (const p of products) {
    const ex = existingMap.get(p.productUrl);
    if (!ex) {
      fresh.push(p);
      continue;
    }
    const patch: ProductUpdate = {};
    // Only fill in fields the existing row is missing — don't overwrite good
    // data with possibly-worse data on re-scrape.
    if (p.caratWeight && !ex.carat_weight) patch.carat_weight = p.caratWeight;
    if (
      p.category &&
      p.category !== "other" &&
      (!ex.category || ex.category === "other")
    )
      patch.category = p.category;
    if (p.imageUrl && !ex.image_url) patch.image_url = p.imageUrl;
    if (p.price != null && ex.price == null) patch.price = p.price;
    if (p.priceDisplay && !ex.price_display)
      patch.price_display = p.priceDisplay;
    if (p.metalType && !ex.metal_type) patch.metal_type = p.metalType;
    if (p.stoneType && !ex.stone_type) patch.stone_type = p.stoneType;
    if (Object.keys(patch).length > 0) {
      updates.push({ id: ex.id, patch });
    }
  }
  const skipped = products.length - fresh.length - updates.length;

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

  // Apply backfills serially. Volume is bounded by what's on a single page
  // so this stays well under the route's time budget.
  for (const u of updates) {
    await supabase.from("products").update(u.patch).eq("id", u.id);
  }

  await supabase
    .from("sources")
    .update({
      last_ingest_at: new Date().toISOString(),
      last_ingest_count: fresh.length,
    })
    .eq("id", source.id);

  const parts: string[] = [];
  if (fresh.length > 0)
    parts.push(`saved ${fresh.length} new product${fresh.length === 1 ? "" : "s"}`);
  if (updates.length > 0)
    parts.push(`updated ${updates.length} with new info`);
  if (skipped > 0) parts.push(`${skipped} already complete`);
  const message = parts.length
    ? `${capitalize(parts.join(", "))} in ${source.name}.`
    : `Nothing changed in ${source.name}.`;

  return cors(
    {
      ok: true,
      added: fresh.length,
      updated: updates.length,
      skipped,
      message,
    },
    200,
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cors(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}
