import type { JewelryCategory } from "../types";
import type { DetectionResult, IngestProduct } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SNJPinterestBot/0.1; +https://github.com/aaditaco-cyber/snj-pinterest)";

const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 250; // Shopify single-page max
const SAMPLE_SIZE = 6;

// Shopify exposes a public product feed at /products.json on most stores. Collections
// expose theirs at /collections/<handle>/products.json. We try the user's URL first
// (if it points at a collection), then a list of common new-arrival handles, then the
// store-wide feed sorted by created_at as a final fallback.
const NEW_ARRIVAL_HANDLES = [
  "new-arrivals",
  "new",
  "new-in",
  "newest",
  "latest",
  "just-in",
  "just-arrived",
];

interface ShopifyVariant {
  id: number;
  price: string;
  sku?: string;
  available: boolean;
  title: string;
}

interface ShopifyImage {
  src: string;
  width?: number;
  height?: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  created_at: string;
  published_at: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyFeed {
  products: ShopifyProduct[];
}

/** Parse a URL, return { origin, collectionHandle? }. Returns null if invalid. */
function parseSourceUrl(rawUrl: string): { origin: string; collectionHandle?: string } | null {
  try {
    const u = new URL(rawUrl);
    const origin = `${u.protocol}//${u.host}`;
    const m = u.pathname.match(/\/collections\/([^/?#]+)/i);
    return { origin, collectionHandle: m?.[1] };
  } catch {
    return null;
  }
}

async function fetchFeed(feedUrl: string, limit = DEFAULT_LIMIT): Promise<ShopifyFeed | null> {
  const url = `${feedUrl}?limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const data = (await res.json()) as ShopifyFeed;
    if (!Array.isArray(data?.products)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Try a sequence of feed URLs and return the first one that yields ≥1 product.
 * Caller can prefer collection-scoped feeds for "new arrivals" hits.
 */
async function findWorkingFeed(
  origin: string,
  collectionHandle: string | undefined,
  limit: number,
): Promise<{ feedUrl: string; feed: ShopifyFeed } | null> {
  const candidates: string[] = [];
  if (collectionHandle) {
    candidates.push(`${origin}/collections/${collectionHandle}/products.json`);
  }
  for (const handle of NEW_ARRIVAL_HANDLES) {
    if (handle === collectionHandle) continue;
    candidates.push(`${origin}/collections/${handle}/products.json`);
  }
  candidates.push(`${origin}/products.json`);

  for (const feedUrl of candidates) {
    const feed = await fetchFeed(feedUrl, limit);
    if (feed && feed.products.length > 0) return { feedUrl, feed };
  }
  return null;
}

/** Map Shopify product_type / tags to our JewelryCategory enum. */
function mapCategory(productType: string, tags: string[]): JewelryCategory {
  const haystack = [productType, ...tags].join(" ").toLowerCase();
  if (/\bring\b|\brings\b/.test(haystack) && /\bbrid|engagement|wedding\b/.test(haystack)) return "bridal";
  if (/\btennis\b/.test(haystack)) return "tennis";
  if (/\bearring/.test(haystack)) return "earrings";
  if (/\bbracelet|cuff|bangle\b/.test(haystack)) return "bracelets";
  if (/\bnecklace|chain|choker\b/.test(haystack)) return "necklaces";
  if (/\bpendant/.test(haystack)) return "pendants";
  if (/\bring\b/.test(haystack)) return "rings";
  if (/\bgemstone|sapphire|emerald|ruby|opal|tanzanite\b/.test(haystack)) return "gemstone";
  return "other";
}

function pickPrice(variants: ShopifyVariant[]): { price?: number; priceDisplay?: string } {
  const prices = variants
    .map((v) => parseFloat(v.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return {};
  const min = Math.min(...prices);
  return {
    price: min,
    priceDisplay: `$${min.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  };
}

function shopifyProductToIngest(
  sp: ShopifyProduct,
  origin: string,
  retailer: string,
  feedUrl: string,
): IngestProduct {
  const productUrl = `${origin}/products/${sp.handle}`;
  const images = sp.images.map((i) => i.src).filter(Boolean);
  const { price, priceDisplay } = pickPrice(sp.variants);
  const category = mapCategory(sp.product_type, sp.tags);
  return {
    title: sp.title,
    imageUrl: images[0] ?? "",
    additionalImages: images.slice(1, 5),
    productUrl,
    retailer,
    price,
    priceDisplay,
    category,
    metalType: undefined,
    caratWeight: undefined,
    stoneType: undefined,
    sourceUrl: feedUrl,
  };
}

/**
 * Sort by published_at desc and filter to only products published within `windowDays`.
 * Products without a parseable published_at get filtered out (we'd rather miss
 * uncertain dates than ingest stale inventory).
 */
function filterByWindow(products: ShopifyProduct[], windowDays: number): ShopifyProduct[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return products
    .filter((p) => {
      if (!p.published_at) return false;
      const t = Date.parse(p.published_at);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

/** Probe a candidate source URL. Returns either samples (success) or a reason (failure). */
export async function detectShopify(
  sourceUrl: string,
  retailer: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<DetectionResult> {
  const parsed = parseSourceUrl(sourceUrl);
  if (!parsed) {
    return { ok: false, platform: "unknown", reason: "Couldn't parse the URL." };
  }
  const found = await findWorkingFeed(parsed.origin, parsed.collectionHandle, DEFAULT_LIMIT);
  if (!found) {
    return {
      ok: false,
      platform: "unknown",
      reason:
        "No Shopify product feed found at this URL. Site may not be Shopify-based, or it may block public feeds.",
    };
  }
  const allWithImages = found.feed.products.filter((p) => p.images.length > 0);
  const inWindow = filterByWindow(allWithImages, windowDays);
  const samples = inWindow
    .slice(0, SAMPLE_SIZE)
    .map((p) => shopifyProductToIngest(p, parsed.origin, retailer, found.feedUrl));
  return {
    ok: true,
    platform: "shopify",
    feedUrl: found.feedUrl,
    totalCount: allWithImages.length,
    inWindowCount: inWindow.length,
    windowDays,
    samples,
  };
}

/** Pull a previously-detected Shopify source, returning only products within the window. */
export async function ingestShopify(
  feedUrl: string,
  origin: string,
  retailer: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  limit: number = DEFAULT_LIMIT,
): Promise<IngestProduct[]> {
  const feed = await fetchFeed(feedUrl, limit);
  if (!feed) return [];
  const withImages = feed.products.filter((p) => p.images.length > 0);
  return filterByWindow(withImages, windowDays).map((p) =>
    shopifyProductToIngest(p, origin, retailer, feedUrl),
  );
}
