import type { IngestProduct } from "../ingest/types";
import type {
  Folder,
  FolderItem,
  JewelryCategory,
  Product,
  ProductStatus,
  Source,
  SourceKind,
  SourcePlatform,
  SwipeAction,
} from "../types";
import { getSupabaseBrowser } from "./browser";
import type {
  FolderInsert,
  FolderItemInsert,
  FolderItemRow,
  FolderItemUpdate,
  FolderRow,
  FolderUpdate,
  ProductInsert,
  ProductRow,
  SourceInsert,
  SourceRow,
  SourceUpdate,
  SwipeActionInsert,
  SwipeActionRow,
  UserProductStateRow,
} from "./database.types";

// ─── snake_case ↔ camelCase mappers ────────────────────────────────────────

function productFromRow(r: ProductRow, status: ProductStatus = "new"): Product {
  return {
    id: r.id,
    sourceId: r.source_id ?? undefined,
    title: r.title,
    imageUrl: r.image_url ?? "",
    additionalImages: r.additional_images,
    productUrl: r.product_url,
    retailer: r.retailer ?? "",
    price: r.price ?? undefined,
    priceDisplay: r.price_display ?? undefined,
    category: (r.category ?? "other") as JewelryCategory,
    metalType: r.metal_type ?? undefined,
    caratWeight: r.carat_weight ?? undefined,
    stoneType: r.stone_type ?? undefined,
    sourceUrl: r.source_url ?? undefined,
    status,
    dateDiscovered: r.date_discovered,
  };
}

function sourceFromRow(r: SourceRow): Source {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    feedUrl: r.feed_url ?? undefined,
    platform: (r.platform ?? undefined) as SourcePlatform | undefined,
    kind: (r.kind ?? "discover") as SourceKind,
    pages: r.pages ?? undefined,
    freshnessWindowDays: r.freshness_window_days,
    category: (r.category ?? undefined) as JewelryCategory | undefined,
    notes: r.notes ?? undefined,
    active: r.active,
    dateAdded: r.date_added,
    lastIngestAt: r.last_ingest_at ?? undefined,
    lastIngestCount: r.last_ingest_count ?? undefined,
    addedBy: r.added_by ?? undefined,
  };
}

function folderFromRow(r: FolderRow): Folder {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon ?? undefined,
    order: r.order,
    archived: r.archived,
    dateCreated: r.date_created,
  };
}

function folderItemFromRow(r: FolderItemRow): FolderItem {
  return {
    id: r.id,
    folderId: r.folder_id,
    productId: r.product_id,
    notes: r.notes ?? undefined,
    tags: r.tags,
    dateAdded: r.date_added,
  };
}

function swipeFromRow(r: SwipeActionRow): SwipeAction {
  return {
    productId: r.product_id,
    action: r.action,
    timestamp: r.timestamp,
    folderIds: r.folder_ids,
  };
}

// ─── Read ───────────────────────────────────────────────────────────────────

export interface InitialData {
  products: Product[];
  sources: Source[];
  folders: Folder[];
  folderItems: FolderItem[];
  recentSwipes: SwipeAction[];
  userId: string;
  userEmail: string | null;
}

/**
 * Fetch everything for the current authenticated user. Sources and products
 * are shared across all users; folders, folder_items, swipe_actions, and
 * user_product_states are per-user (RLS enforces).
 */
export async function fetchAll(): Promise<InitialData> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  const [productsRes, sourcesRes, foldersRes, folderItemsRes, swipesRes, statesRes] =
    await Promise.all([
      supabase.from("products").select("*").order("date_discovered", { ascending: false }),
      supabase.from("sources").select("*").order("name", { ascending: true }),
      supabase.from("folders").select("*").order("order", { ascending: true }),
      supabase.from("folder_items").select("*").order("date_added", { ascending: false }),
      supabase
        .from("swipe_actions")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase.from("user_product_states").select("*"),
    ]);

  for (const res of [
    productsRes,
    sourcesRes,
    foldersRes,
    folderItemsRes,
    swipesRes,
    statesRes,
  ]) {
    if (res.error) throw res.error;
  }

  const stateByProduct = new Map<string, ProductStatus>();
  for (const row of (statesRes.data ?? []) as UserProductStateRow[]) {
    stateByProduct.set(row.product_id, row.status);
  }

  return {
    products: (productsRes.data ?? []).map((r) =>
      productFromRow(r, stateByProduct.get(r.id) ?? "new"),
    ),
    sources: (sourcesRes.data ?? []).map(sourceFromRow),
    folders: (foldersRes.data ?? []).map(folderFromRow),
    folderItems: (folderItemsRes.data ?? []).map(folderItemFromRow),
    recentSwipes: (swipesRes.data ?? []).map(swipeFromRow),
    userId: user.id,
    userEmail: user.email ?? null,
  };
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function updateProductStatus(
  userId: string,
  productId: string,
  status: ProductStatus,
): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (status === "new") {
    // Absence of a row = "new"; clear any existing state.
    const { error } = await supabase
      .from("user_product_states")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("user_product_states").upsert(
    {
      user_id: userId,
      product_id: productId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id" },
  );
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function ingestProducts(
  sourceId: string,
  retailer: string,
  incoming: IngestProduct[],
): Promise<{ added: Product[]; skipped: number }> {
  if (incoming.length === 0) return { added: [], skipped: 0 };
  const supabase = getSupabaseBrowser();

  // Find which productUrls already exist globally — products are shared.
  const incomingUrls = incoming.map((p) => p.productUrl).filter(Boolean);
  const { data: existing, error: existingErr } = await supabase
    .from("products")
    .select("product_url")
    .in("product_url", incomingUrls);
  if (existingErr) throw existingErr;
  const existingSet = new Set((existing ?? []).map((r) => r.product_url));

  const fresh = incoming.filter(
    (p) => p.productUrl && !existingSet.has(p.productUrl),
  );
  const skipped = incoming.length - fresh.length;
  if (fresh.length === 0) return { added: [], skipped };

  const rows: ProductInsert[] = fresh.map((p) => ({
    source_id: sourceId,
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

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert(rows)
    .select();
  if (insertErr) throw insertErr;

  const now = new Date().toISOString();
  await supabase
    .from("sources")
    .update({ last_ingest_at: now, last_ingest_count: rows.length })
    .eq("id", sourceId);

  return { added: (inserted ?? []).map((r) => productFromRow(r)), skipped };
}

// ─── Sources ────────────────────────────────────────────────────────────────

export async function addSourceRow(
  userId: string,
  input: {
    name: string;
    url: string;
    feedUrl?: string;
    platform?: SourcePlatform;
    freshnessWindowDays?: number;
    category?: JewelryCategory;
    notes?: string;
  },
): Promise<Source> {
  const row: SourceInsert = {
    added_by: userId,
    name: input.name,
    url: input.url,
    feed_url: input.feedUrl ?? null,
    platform: input.platform ?? null,
    freshness_window_days: input.freshnessWindowDays ?? 30,
    category: input.category ?? null,
    notes: input.notes ?? null,
    active: true,
  };
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from("sources").insert(row).select().single();
  if (error) throw error;
  return sourceFromRow(data);
}

export async function updateSourceRow(
  id: string,
  patch: Partial<Source>,
): Promise<void> {
  const supabase = getSupabaseBrowser();
  const update = sourcePatchToRow(patch);
  const { error } = await supabase.from("sources").update(update).eq("id", id);
  if (error) throw error;
}

function sourcePatchToRow(p: Partial<Source>): SourceUpdate {
  const out: SourceUpdate = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.url !== undefined) out.url = p.url;
  if (p.feedUrl !== undefined) out.feed_url = p.feedUrl ?? null;
  if (p.platform !== undefined) out.platform = p.platform;
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.pages !== undefined) out.pages = p.pages ?? null;
  if (p.freshnessWindowDays !== undefined) out.freshness_window_days = p.freshnessWindowDays;
  if (p.category !== undefined) out.category = p.category ?? null;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  if (p.active !== undefined) out.active = p.active;
  if (p.lastIngestAt !== undefined) out.last_ingest_at = p.lastIngestAt;
  if (p.lastIngestCount !== undefined) out.last_ingest_count = p.lastIngestCount;
  return out;
}

// ─── Research sources ───────────────────────────────────────────────────────

export async function addResearchSourceRow(
  userId: string,
  input: {
    name: string;
    pages: string[];
    category?: JewelryCategory;
    notes?: string;
  },
): Promise<Source> {
  // Research sources don't have a single canonical URL — we use the first
  // page URL so the existing unique(url) constraint stays meaningful.
  const primaryUrl = input.pages[0];
  if (!primaryUrl) throw new Error("Research source needs at least one page URL.");
  const row: SourceInsert = {
    added_by: userId,
    name: input.name,
    url: primaryUrl,
    kind: "research",
    pages: input.pages,
    platform: "custom",
    freshness_window_days: 365,
    category: input.category ?? null,
    notes: input.notes ?? null,
    active: true,
  };
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.from("sources").insert(row).select().single();
  if (error) throw error;
  return sourceFromRow(data);
}

export async function deleteSource(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw error;
}

// ─── Folders ────────────────────────────────────────────────────────────────

export async function addFolderRow(
  userId: string,
  input: { name: string; color: string; icon?: string },
): Promise<Folder> {
  const supabase = getSupabaseBrowser();
  // Compute next order locally (RLS makes this user-scoped already).
  const { data: orderRows } = await supabase
    .from("folders")
    .select("order")
    .order("order", { ascending: false })
    .limit(1);
  const nextOrder = (orderRows?.[0]?.order ?? -1) + 1;

  const row: FolderInsert = {
    user_id: userId,
    name: input.name,
    color: input.color,
    icon: input.icon ?? null,
    order: nextOrder,
    archived: false,
  };
  const { data, error } = await supabase.from("folders").insert(row).select().single();
  if (error) throw error;
  return folderFromRow(data);
}

export async function updateFolderRow(
  id: string,
  patch: Partial<Folder>,
): Promise<void> {
  const update: FolderUpdate = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.icon !== undefined) update.icon = patch.icon ?? null;
  if (patch.order !== undefined) update.order = patch.order;
  if (patch.archived !== undefined) update.archived = patch.archived;
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("folders").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

// ─── Folder items ───────────────────────────────────────────────────────────

export async function addToFolder(
  userId: string,
  productId: string,
  folderId: string,
  notes?: string,
): Promise<FolderItem | null> {
  const row: FolderItemInsert = {
    user_id: userId,
    folder_id: folderId,
    product_id: productId,
    notes: notes ?? null,
    tags: [],
  };
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("folder_items")
    .insert(row)
    .select()
    .single();
  if (error) {
    // Unique violation (product already in folder) is not a real error.
    if (error.code === "23505") return null;
    throw error;
  }
  return folderItemFromRow(data);
}

export async function removeFolderItem(folderItemId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("folder_items").delete().eq("id", folderItemId);
  if (error) throw error;
}

export async function updateFolderItemRow(
  id: string,
  patch: Partial<FolderItem>,
): Promise<void> {
  const update: FolderItemUpdate = {};
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (patch.tags !== undefined) update.tags = patch.tags;
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("folder_items").update(update).eq("id", id);
  if (error) throw error;
}

// ─── Swipe actions ──────────────────────────────────────────────────────────

export async function recordSwipe(
  userId: string,
  productId: string,
  action: "skip" | "save",
  folderIds: string[] = [],
): Promise<SwipeAction> {
  const row: SwipeActionInsert = {
    user_id: userId,
    product_id: productId,
    action,
    folder_ids: folderIds,
  };
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("swipe_actions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return swipeFromRow(data);
}

export async function deleteRecentSwipe(productId: string): Promise<void> {
  // Pop the most recent swipe for this product (used by undo).
  const supabase = getSupabaseBrowser();
  const { data } = await supabase
    .from("swipe_actions")
    .select("id")
    .eq("product_id", productId)
    .order("timestamp", { ascending: false })
    .limit(1);
  if (!data?.[0]) return;
  await supabase.from("swipe_actions").delete().eq("id", data[0].id);
}

// ─── Reset ──────────────────────────────────────────────────────────────────

/**
 * Resets only the calling user's per-user data (folders, folder_items,
 * swipe_actions, user_product_states). Shared sources and products are NOT
 * affected — to wipe those, re-run supabase/schema.sql.
 */
export async function resetAllData(userId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  // folder_items and swipe_actions cascade from folders/products, but we
  // explicitly clear them so a user with no folders still gets wiped.
  await Promise.all([
    supabase.from("folder_items").delete().eq("user_id", userId),
    supabase.from("swipe_actions").delete().eq("user_id", userId),
    supabase.from("user_product_states").delete().eq("user_id", userId),
  ]);
  await supabase.from("folders").delete().eq("user_id", userId);
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowser();
  await supabase.auth.signOut();
}
