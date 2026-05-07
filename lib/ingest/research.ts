/**
 * Generic page scraper for Research-mode sources.
 *
 * Strategy, in order:
 *   1. Parse <script type="application/ld+json"> blocks. Look for Schema.org
 *      `Product` entities (PDPs) and `ItemList` entities (collection pages).
 *      This is what Google indexes — most modern e-commerce sites publish it.
 *   2. Fall back to OpenGraph meta tags (og:title, og:image, product:price).
 *   3. If the URL host responds at /products.json, route through the Shopify
 *      adapter as a last resort.
 *
 * Outputs `IngestProduct[]` (same shape as the Shopify adapter), so downstream
 * code is identical.
 */

import type { JewelryCategory } from "../types";
import type { IngestProduct } from "./types";
import { ingestShopify } from "./shopify";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 20_000;
// Don't ingest more than this per page — keeps blast radius bounded if we
// stumble on a site listing thousands of items.
const MAX_PER_PAGE = 200;

interface ProbeResult {
  ok: boolean;
  count: number;
  source: "json-ld" | "opengraph" | "shopify" | "none";
  reason?: string;
  samples: IngestProduct[];
}

export interface ResearchProbeResult extends ProbeResult {
  url: string;
}

/** Probe a single page and return up to 6 sample products + total count. */
export async function probeResearchPage(
  url: string,
  retailer: string,
): Promise<ResearchProbeResult> {
  const products = await scrapeResearchPage(url, retailer);
  if (products.length === 0) {
    return {
      url,
      ok: false,
      count: 0,
      source: "none",
      reason:
        "Couldn't extract products. Page may not have JSON-LD or OpenGraph product data.",
      samples: [],
    };
  }
  return {
    url,
    ok: true,
    count: products.length,
    source: products[0]._source ?? "json-ld",
    samples: products.slice(0, 6).map(stripInternal),
  };
}

/** Scrape a page and return all extracted products. */
export async function scrapeResearchPage(
  url: string,
  retailer: string,
): Promise<InternalIngestProduct[]> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const origin = safeOrigin(url);
  const fromHtml = extractProductsFromHtml(html, url, retailer);
  if (fromHtml.length > 0) return fromHtml.slice(0, MAX_PER_PAGE);

  // Shopify fallback (only useful when the HTML didn't surface anything).
  if (origin) {
    try {
      const shopifyProducts = await ingestShopify(
        `${origin}/products.json`,
        origin,
        retailer,
        365,
        MAX_PER_PAGE,
      );
      if (shopifyProducts.length > 0) {
        return shopifyProducts.map((p) => ({ ...p, _source: "shopify" }));
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Extract products from already-fetched HTML. Used both by the server-side
 * scraper and by the bookmarklet ingest endpoint (which receives an HTML
 * snapshot from the user's browser).
 */
export function extractProductsFromHtml(
  html: string,
  pageUrl: string,
  retailer: string,
): InternalIngestProduct[] {
  const origin = safeOrigin(pageUrl);
  const ld = extractJsonLdProducts(html, origin, retailer);
  if (ld.length > 0) return ld;
  const og = extractOpenGraph(html, pageUrl, retailer);
  return og ? [og] : [];
}

/**
 * Process pre-parsed JSON-LD blocks (sent by the bookmarklet) plus an
 * OpenGraph map. Equivalent to `extractProductsFromHtml` but skips the HTML
 * parsing step.
 */
export function extractProductsFromLd(
  ldBlocks: unknown[],
  og: Record<string, string>,
  pageUrl: string,
  retailer: string,
): IngestProduct[] {
  const origin = safeOrigin(pageUrl);
  const products: InternalIngestProduct[] = [];
  const seenUrls = new Set<string>();

  for (const block of ldBlocks) {
    walkLd(block, (node) => {
      if (isProduct(node)) {
        const p = ldProductToIngest(node, origin, retailer);
        if (p && !seenUrls.has(p.productUrl)) {
          seenUrls.add(p.productUrl);
          products.push({ ...p, _source: "json-ld" });
        }
      } else if (isItemList(node) && Array.isArray(node.itemListElement)) {
        for (const el of node.itemListElement) {
          if (typeof el.item === "object" && el.item) {
            const p = ldProductToIngest(el.item, origin, retailer);
            if (p && !seenUrls.has(p.productUrl)) {
              seenUrls.add(p.productUrl);
              products.push({ ...p, _source: "json-ld" });
            }
          }
        }
      }
    });
  }

  if (products.length === 0) {
    const fromOg = ogMapToProduct(og, pageUrl, retailer);
    if (fromOg) products.push(fromOg);
  }

  return products.slice(0, MAX_PER_PAGE).map(stripInternal);
}

interface InternalIngestProduct extends IngestProduct {
  _source?: "json-ld" | "opengraph" | "shopify";
}

function stripInternal(p: InternalIngestProduct): IngestProduct {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _source, ...rest } = p;
  return rest;
}

function safeOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// ─── JSON-LD extraction ─────────────────────────────────────────────────────

interface LdProduct {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[] | { url?: string }[];
  url?: string;
  offers?: LdOffer | LdOffer[];
  brand?: string | { name?: string };
  category?: string;
  productID?: string;
  sku?: string;
  description?: string;
  mainEntityOfPage?: string | { "@id"?: string };
}

interface LdOffer {
  "@type"?: string;
  price?: string | number;
  priceCurrency?: string;
  priceSpecification?: { price?: string | number };
  url?: string;
}

interface LdItemList {
  "@type"?: string | string[];
  itemListElement?: LdItemListElement[];
}

interface LdItemListElement {
  "@type"?: string;
  position?: number;
  url?: string;
  name?: string;
  item?: LdProduct | string;
}

function extractJsonLdProducts(
  html: string,
  origin: string | null,
  retailer: string,
): InternalIngestProduct[] {
  const blocks = extractJsonLdBlocks(html);
  const products: InternalIngestProduct[] = [];
  const seenUrls = new Set<string>();

  for (const block of blocks) {
    walkLd(block, (node) => {
      if (isProduct(node)) {
        const p = ldProductToIngest(node, origin, retailer);
        if (p && !seenUrls.has(p.productUrl)) {
          seenUrls.add(p.productUrl);
          products.push({ ...p, _source: "json-ld" });
        }
      } else if (isItemList(node) && Array.isArray(node.itemListElement)) {
        for (const el of node.itemListElement) {
          if (typeof el.item === "object" && el.item) {
            const p = ldProductToIngest(el.item, origin, retailer);
            if (p && !seenUrls.has(p.productUrl)) {
              seenUrls.add(p.productUrl);
              products.push({ ...p, _source: "json-ld" });
            }
          } else if (typeof el === "object" && el.url) {
            // ItemList of plain URLs (rare) — title-only, will pass minimal data
            const url = absolutize(el.url, origin);
            if (url && !seenUrls.has(url) && el.name) {
              seenUrls.add(url);
              products.push({
                title: el.name,
                imageUrl: "",
                productUrl: url,
                retailer,
                category: "other",
                _source: "json-ld",
              });
            }
          }
        }
      }
    });
  }

  return products;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script\b[^>]*?type=["']application\/ld\+json["'][^>]*?>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites HTML-encode things or include trailing commas; try a light cleanup.
      try {
        blocks.push(JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")));
      } catch {
        // skip
      }
    }
  }
  return blocks;
}

function walkLd(node: unknown, visit: (n: LdProduct & LdItemList) => void) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkLd(item, visit);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  // @graph wrapper used by some CMSes
  if (Array.isArray(obj["@graph"])) {
    walkLd(obj["@graph"], visit);
  }
  visit(obj as LdProduct & LdItemList);
}

function isProduct(node: LdProduct): boolean {
  const t = node["@type"];
  if (!t) return false;
  if (typeof t === "string") return /^Product$/i.test(t);
  return t.some((x) => /^Product$/i.test(x));
}

function isItemList(node: LdItemList): boolean {
  const t = node["@type"];
  if (!t) return false;
  if (typeof t === "string") return /^ItemList$/i.test(t);
  return t.some((x) => /^ItemList$/i.test(x));
}

function ldProductToIngest(
  node: LdProduct,
  origin: string | null,
  retailer: string,
): InternalIngestProduct | null {
  const title = node.name?.trim();
  if (!title) return null;

  const explicitUrl =
    node.url ??
    (typeof node.mainEntityOfPage === "string"
      ? node.mainEntityOfPage
      : node.mainEntityOfPage?.["@id"]) ??
    (Array.isArray(node.offers)
      ? node.offers[0]?.url
      : node.offers?.url);

  const productUrl = absolutize(explicitUrl, origin);
  if (!productUrl) return null;

  const images = collectImages(node.image);
  const { price, priceDisplay } = ldPickPrice(node.offers);
  const category = inferCategory(title, node.category);

  return {
    title,
    imageUrl: images[0] ?? "",
    additionalImages: images.slice(1, 5),
    productUrl,
    retailer,
    price,
    priceDisplay,
    category,
    sourceUrl: undefined,
  };
}

function collectImages(
  image: LdProduct["image"] | undefined,
): string[] {
  if (!image) return [];
  if (typeof image === "string") return [image];
  if (Array.isArray(image)) {
    return image
      .map((i) => (typeof i === "string" ? i : i?.url))
      .filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  return [];
}

function ldPickPrice(
  offers: LdProduct["offers"],
): { price?: number; priceDisplay?: string } {
  if (!offers) return {};
  const all = Array.isArray(offers) ? offers : [offers];
  const prices: number[] = [];
  for (const o of all) {
    const raw = o.price ?? o.priceSpecification?.price;
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) prices.push(n);
  }
  if (prices.length === 0) return {};
  const min = Math.min(...prices);
  return {
    price: min,
    priceDisplay: `$${min.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  };
}

function absolutize(url: string | undefined, origin: string | null): string {
  if (!url) return "";
  try {
    return new URL(url, origin ?? undefined).toString();
  } catch {
    return "";
  }
}

// ─── OpenGraph fallback ─────────────────────────────────────────────────────

function extractOpenGraph(
  html: string,
  pageUrl: string,
  retailer: string,
): InternalIngestProduct | null {
  const get = (prop: string) => {
    const re = new RegExp(
      `<meta\\s+[^>]*?(?:property|name)=["']${prop}["'][^>]*?content=["']([^"']+)["'][^>]*?>`,
      "i",
    );
    const m = re.exec(html);
    return m?.[1];
  };
  const map: Record<string, string> = {};
  for (const key of [
    "og:type",
    "og:title",
    "og:image",
    "og:url",
    "product:price:amount",
    "og:price:amount",
    "twitter:data1",
  ]) {
    const v = get(key);
    if (v) map[key] = v;
  }
  return ogMapToProduct(map, pageUrl, retailer);
}

function ogMapToProduct(
  map: Record<string, string>,
  pageUrl: string,
  retailer: string,
): InternalIngestProduct | null {
  const ogType = map["og:type"];
  if (!ogType || !/product/i.test(ogType)) return null;
  const title = map["og:title"];
  if (!title) return null;
  const image = map["og:image"] ?? "";
  const url = map["og:url"] ?? pageUrl;
  const priceRaw =
    map["product:price:amount"] ?? map["og:price:amount"] ?? map["twitter:data1"];
  const priceN = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, "")) : NaN;
  const price = Number.isFinite(priceN) && priceN > 0 ? priceN : undefined;
  return {
    title,
    imageUrl: image,
    productUrl: url,
    retailer,
    price,
    priceDisplay: price
      ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : undefined,
    category: inferCategory(title),
    _source: "opengraph",
  };
}

// ─── Category inference ─────────────────────────────────────────────────────

function inferCategory(
  title: string,
  hint?: string | undefined,
): JewelryCategory {
  const haystack = `${title} ${hint ?? ""}`.toLowerCase();
  if (/\bbridal|engagement|wedding band\b/.test(haystack)) return "bridal";
  if (/\btennis\b/.test(haystack)) return "tennis";
  if (/\bearring/.test(haystack)) return "earrings";
  if (/\bbracelet|cuff|bangle\b/.test(haystack)) return "bracelets";
  if (/\bnecklace|chain|choker\b/.test(haystack)) return "necklaces";
  if (/\bpendant/.test(haystack)) return "pendants";
  if (/\bring\b/.test(haystack)) return "rings";
  if (/\bsapphire|emerald|ruby|opal|tanzanite|gemstone\b/.test(haystack))
    return "gemstone";
  return "other";
}
