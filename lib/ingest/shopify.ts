import type { JewelryCategory } from "../types";
import type { DetectionResult, IngestProduct } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SNJPinterestBot/0.1; +https://github.com/aaditaco-cyber/snj-pinterest)";

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

async function fetchFeed(feedUrl: string, limit = 50): Promise<ShopifyFeed | null> {
  const url = `${feedUrl}?limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Shopify feeds are public; no creds needed.
      signal: AbortSignal.timeout(10_000),
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
    const feed = await fetchFeed(feedUrl, 50);
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

/** Probe a candidate source URL. Returns either samples (success) or a reason (failure). */
export async function detectShopify(
  sourceUrl: string,
  retailer: string,
): Promise<DetectionResult> {
  const parsed = parseSourceUrl(sourceUrl);
  if (!parsed) {
    return { ok: false, platform: "unknown", reason: "Couldn't parse the URL." };
  }
  const found = await findWorkingFeed(parsed.origin, parsed.collectionHandle);
  if (!found) {
    return {
      ok: false,
      platform: "unknown",
      reason:
        "No Shopify product feed found at this URL. Site may not be Shopify-based, or it may block public feeds.",
    };
  }
  const products = found.feed.products
    .filter((p) => p.images.length > 0)
    .map((p) => shopifyProductToIngest(p, parsed.origin, retailer, found.feedUrl));
  return {
    ok: true,
    platform: "shopify",
    feedUrl: found.feedUrl,
    productCount: products.length,
    samples: products.slice(0, 6),
  };
}

/** Pull the full feed from a previously-detected Shopify source. */
export async function ingestShopify(
  feedUrl: string,
  origin: string,
  retailer: string,
  limit = 50,
): Promise<IngestProduct[]> {
  const feed = await fetchFeed(feedUrl, limit);
  if (!feed) return [];
  return feed.products
    .filter((p) => p.images.length > 0)
    .map((p) => shopifyProductToIngest(p, origin, retailer, feedUrl));
}
