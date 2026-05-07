/**
 * Service-role data access for the cron route. Bypasses RLS.
 * Sources and products are shared globally, so cron pulls each active source
 * once and writes products into the shared pool — no per-user fan-out.
 * NEVER import from a Client Component.
 */

import { ingestShopify } from "../ingest/shopify";
import { getSupabaseService } from "./service";
import type { ProductInsert, SourceRow } from "./database.types";

export interface CronSourceResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  added: number;
  skipped: number;
  inWindow: number;
  reason?: string;
}

/**
 * Pull every active Shopify source, dedupe globally, insert new products.
 * Returns per-source results for telemetry.
 */
export async function pullAllActiveSources(): Promise<CronSourceResult[]> {
  const supabase = getSupabaseService();
  const { data: sources, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    .eq("platform", "shopify");
  if (error) throw error;

  const results: CronSourceResult[] = [];
  for (const source of (sources ?? []) as SourceRow[]) {
    const r = await pullOneSource(source);
    results.push(r);
  }
  return results;
}

async function pullOneSource(source: SourceRow): Promise<CronSourceResult> {
  const supabase = getSupabaseService();
  if (!source.feed_url) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: false,
      added: 0,
      skipped: 0,
      inWindow: 0,
      reason: "missing feed_url",
    };
  }

  let inWindow: { productUrl: string; insert: ProductInsert }[] = [];
  try {
    const origin = new URL(source.feed_url).origin;
    const products = await ingestShopify(
      source.feed_url,
      origin,
      source.name,
      source.freshness_window_days,
      250,
    );
    inWindow = products
      .filter((p) => p.productUrl)
      .map((p) => ({
        productUrl: p.productUrl,
        insert: {
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
        } satisfies ProductInsert,
      }));
  } catch (e) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: false,
      added: 0,
      skipped: 0,
      inWindow: 0,
      reason: e instanceof Error ? e.message : "ingest error",
    };
  }

  if (inWindow.length === 0) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: true,
      added: 0,
      skipped: 0,
      inWindow: 0,
    };
  }

  // Dedupe globally — products are shared across all users.
  const urls = inWindow.map((x) => x.productUrl);
  const { data: existing, error: dedupeErr } = await supabase
    .from("products")
    .select("product_url")
    .in("product_url", urls);
  if (dedupeErr) throw dedupeErr;
  const existingSet = new Set((existing ?? []).map((r) => r.product_url));

  const fresh = inWindow.filter((x) => !existingSet.has(x.productUrl));
  const skipped = inWindow.length - fresh.length;

  if (fresh.length > 0) {
    const { error: insertErr } = await supabase
      .from("products")
      .insert(fresh.map((x) => x.insert));
    if (insertErr) throw insertErr;
  }

  await supabase
    .from("sources")
    .update({
      last_ingest_at: new Date().toISOString(),
      last_ingest_count: fresh.length,
    })
    .eq("id", source.id);

  return {
    sourceId: source.id,
    sourceName: source.name,
    ok: true,
    added: fresh.length,
    skipped,
    inWindow: inWindow.length,
  };
}
