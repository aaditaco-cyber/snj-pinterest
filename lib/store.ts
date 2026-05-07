import { create } from "zustand";
import * as repo from "./supabase/repo";
import type { IngestProduct } from "./ingest/types";
import type {
  FilterState,
  Folder,
  FolderItem,
  JewelryCategory,
  Product,
  Source,
  SourcePlatform,
  SwipeAction,
} from "./types";

const MAX_RECENT_SWIPES = 50;

const tempId = (prefix: string) =>
  `tmp-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface StoreState {
  hydrated: boolean;
  hydrating: boolean;
  hydrationError: string | null;
  userId: string | null;
  userEmail: string | null;

  products: Product[];
  sources: Source[];
  folders: Folder[];
  folderItems: FolderItem[];
  recentSwipes: SwipeAction[];
  filter: FilterState;

  hydrate: () => Promise<void>;
  reset: () => void;

  // Filter
  setFilter: (next: Partial<FilterState>) => void;

  // Swipe / status
  skipProduct: (productId: string) => Promise<void>;
  saveProduct: (productId: string) => Promise<void>;
  undoLastSwipe: () => Promise<void>;
  restoreSkippedProduct: (productId: string) => Promise<void>;
  restoreAllSkipped: () => Promise<void>;

  // Sources
  addSource: (input: {
    name: string;
    url: string;
    feedUrl?: string;
    platform?: SourcePlatform;
    freshnessWindowDays?: number;
    category?: JewelryCategory;
    notes?: string;
  }) => Promise<string | null>;
  addResearchSource: (input: {
    name: string;
    pages: string[];
    category?: JewelryCategory;
    notes?: string;
  }) => Promise<string | null>;
  updateSource: (id: string, patch: Partial<Source>) => Promise<void>;
  toggleSourceActive: (id: string) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  ingestResearchSource: (sourceId: string) => Promise<{ added: number; skipped: number; reason?: string }>;
  getBookmarkletToken: () => Promise<string | null>;
  regenerateBookmarkletToken: () => Promise<string | null>;

  // Folders
  addFolder: (input: { name: string; color: string; icon?: string }) => Promise<string | null>;
  updateFolder: (id: string, patch: Partial<Folder>) => Promise<void>;
  archiveFolder: (id: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;

  // FolderItems
  addToFolder: (productId: string, folderId: string, notes?: string) => Promise<void>;
  removeFromFolder: (folderItemId: string) => Promise<void>;
  updateFolderItem: (id: string, patch: Partial<FolderItem>) => Promise<void>;

  // Ingestion
  addIngestedProducts: (
    sourceId: string,
    retailer: string,
    incoming: IngestProduct[],
  ) => Promise<{ added: number; skipped: number }>;

  // Admin
  resetAll: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultFilter: FilterState = {
  category: "all",
  sort: "newest",
  retailer: "all",
};

export const useStore = create<StoreState>()((set, get) => ({
  hydrated: false,
  hydrating: false,
  hydrationError: null,
  userId: null,
  userEmail: null,
  products: [],
  sources: [],
  folders: [],
  folderItems: [],
  recentSwipes: [],
  filter: defaultFilter,

  hydrate: async () => {
    if (get().hydrating || get().hydrated) return;
    set({ hydrating: true, hydrationError: null });
    try {
      const data = await repo.fetchAll();
      set({
        products: data.products,
        sources: data.sources,
        folders: data.folders,
        folderItems: data.folderItems,
        recentSwipes: data.recentSwipes,
        userId: data.userId,
        userEmail: data.userEmail,
        hydrated: true,
        hydrating: false,
      });
    } catch (e) {
      set({
        hydrationError: e instanceof Error ? e.message : "Failed to load data",
        hydrating: false,
      });
    }
  },

  reset: () =>
    set({
      hydrated: false,
      hydrating: false,
      hydrationError: null,
      userId: null,
      userEmail: null,
      products: [],
      sources: [],
      folders: [],
      folderItems: [],
      recentSwipes: [],
      filter: defaultFilter,
    }),

  setFilter: (next) => set((s) => ({ filter: { ...s.filter, ...next } })),

  // ─── Swipe / status ───────────────────────────────────────────────────────

  skipProduct: async (productId) => {
    const userId = get().userId;
    if (!userId) return;
    // Optimistic
    const swipe: SwipeAction = {
      productId,
      action: "skip",
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      products: s.products.map((p) =>
        p.id === productId ? { ...p, status: "skipped" } : p,
      ),
      recentSwipes: [swipe, ...s.recentSwipes].slice(0, MAX_RECENT_SWIPES),
    }));
    try {
      await Promise.all([
        repo.updateProductStatus(userId, productId, "skipped"),
        repo.recordSwipe(userId, productId, "skip"),
      ]);
    } catch (e) {
      console.error("skipProduct failed:", e);
    }
  },

  saveProduct: async (productId) => {
    const userId = get().userId;
    if (!userId) return;
    const swipe: SwipeAction = {
      productId,
      action: "save",
      timestamp: new Date().toISOString(),
      folderIds: [],
    };
    set((s) => ({
      products: s.products.map((p) =>
        p.id === productId ? { ...p, status: "saved" } : p,
      ),
      recentSwipes: [swipe, ...s.recentSwipes].slice(0, MAX_RECENT_SWIPES),
    }));
    try {
      await Promise.all([
        repo.updateProductStatus(userId, productId, "saved"),
        repo.recordSwipe(userId, productId, "save"),
      ]);
    } catch (e) {
      console.error("saveProduct failed:", e);
    }
  },

  undoLastSwipe: async () => {
    const userId = get().userId;
    if (!userId) return;
    const last = get().recentSwipes[0];
    if (!last) return;
    set((s) => ({
      products: s.products.map((p) =>
        p.id === last.productId ? { ...p, status: "new" } : p,
      ),
      folderItems:
        last.action === "save" && last.folderIds?.length
          ? s.folderItems.filter(
              (fi) =>
                !(
                  fi.productId === last.productId &&
                  last.folderIds!.includes(fi.folderId)
                ),
            )
          : s.folderItems,
      recentSwipes: s.recentSwipes.slice(1),
    }));
    try {
      await repo.updateProductStatus(userId, last.productId, "new");
      await repo.deleteRecentSwipe(last.productId);
    } catch (e) {
      console.error("undoLastSwipe failed:", e);
    }
  },

  restoreSkippedProduct: async (productId) => {
    const userId = get().userId;
    if (!userId) return;
    set((s) => ({
      products: s.products.map((p) =>
        p.id === productId && p.status === "skipped" ? { ...p, status: "new" } : p,
      ),
    }));
    try {
      await repo.updateProductStatus(userId, productId, "new");
    } catch (e) {
      console.error("restoreSkippedProduct failed:", e);
    }
  },

  restoreAllSkipped: async () => {
    const userId = get().userId;
    if (!userId) return;
    const skippedIds = get()
      .products.filter((p) => p.status === "skipped")
      .map((p) => p.id);
    set((s) => ({
      products: s.products.map((p) =>
        p.status === "skipped" ? { ...p, status: "new" } : p,
      ),
    }));
    try {
      await Promise.all(
        skippedIds.map((id) => repo.updateProductStatus(userId, id, "new")),
      );
    } catch (e) {
      console.error("restoreAllSkipped failed:", e);
    }
  },

  // ─── Sources ──────────────────────────────────────────────────────────────

  addSource: async (input) => {
    const userId = get().userId;
    if (!userId) return null;
    try {
      const created = await repo.addSourceRow(userId, input);
      set((s) => ({ sources: [...s.sources, created] }));
      return created.id;
    } catch (e) {
      console.error("addSource failed:", e);
      return null;
    }
  },

  addResearchSource: async (input) => {
    const userId = get().userId;
    if (!userId) return null;
    try {
      const created = await repo.addResearchSourceRow(userId, input);
      set((s) => ({ sources: [...s.sources, created] }));
      return created.id;
    } catch (e) {
      console.error("addResearchSource failed:", e);
      return null;
    }
  },

  getBookmarkletToken: async () => {
    const userId = get().userId;
    if (!userId) return null;
    try {
      return await repo.getOrCreateBookmarkletToken(userId);
    } catch (e) {
      console.error("getBookmarkletToken failed:", e);
      return null;
    }
  },

  regenerateBookmarkletToken: async () => {
    const userId = get().userId;
    if (!userId) return null;
    try {
      return await repo.regenerateBookmarkletToken(userId);
    } catch (e) {
      console.error("regenerateBookmarkletToken failed:", e);
      return null;
    }
  },

  ingestResearchSource: async (sourceId) => {
    const src = get().sources.find((s) => s.id === sourceId);
    if (!src || src.kind !== "research" || !src.pages?.length) {
      return { added: 0, skipped: 0, reason: "Source has no pages." };
    }
    try {
      const res = await fetch("/api/research/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: src.pages, retailer: src.name }),
      });
      const data = (await res.json()) as
        | { ok: true; products: import("./ingest/types").IngestProduct[] }
        | { ok: false; reason: string };
      if (!data.ok) return { added: 0, skipped: 0, reason: data.reason };
      const result = await repo.ingestProducts(sourceId, src.name, data.products);
      set((s) => ({
        products: [...s.products, ...result.added],
        sources: s.sources.map((x) =>
          x.id === sourceId
            ? {
                ...x,
                lastIngestAt: new Date().toISOString(),
                lastIngestCount: result.added.length,
              }
            : x,
        ),
      }));
      return { added: result.added.length, skipped: result.skipped };
    } catch (e) {
      console.error("ingestResearchSource failed:", e);
      return {
        added: 0,
        skipped: 0,
        reason: e instanceof Error ? e.message : "Network error",
      };
    }
  },

  updateSource: async (id, patch) => {
    set((s) => ({
      sources: s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)),
    }));
    try {
      await repo.updateSourceRow(id, patch);
    } catch (e) {
      console.error("updateSource failed:", e);
    }
  },

  toggleSourceActive: async (id) => {
    const src = get().sources.find((s) => s.id === id);
    if (!src) return;
    const next = !src.active;
    set((s) => ({
      sources: s.sources.map((x) => (x.id === id ? { ...x, active: next } : x)),
    }));
    try {
      await repo.updateSourceRow(id, { active: next });
    } catch (e) {
      console.error("toggleSourceActive failed:", e);
    }
  },

  removeSource: async (id) => {
    set((s) => ({ sources: s.sources.filter((src) => src.id !== id) }));
    try {
      await repo.deleteSource(id);
    } catch (e) {
      console.error("removeSource failed:", e);
    }
  },

  // ─── Folders ──────────────────────────────────────────────────────────────

  addFolder: async (input) => {
    const userId = get().userId;
    if (!userId) return null;
    try {
      const created = await repo.addFolderRow(userId, input);
      set((s) => ({ folders: [...s.folders, created] }));
      return created.id;
    } catch (e) {
      console.error("addFolder failed:", e);
      return null;
    }
  },

  updateFolder: async (id, patch) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    try {
      await repo.updateFolderRow(id, patch);
    } catch (e) {
      console.error("updateFolder failed:", e);
    }
  },

  archiveFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    const next = !folder.archived;
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, archived: next } : f)),
    }));
    try {
      await repo.updateFolderRow(id, { archived: next });
    } catch (e) {
      console.error("archiveFolder failed:", e);
    }
  },

  removeFolder: async (id) => {
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      folderItems: s.folderItems.filter((fi) => fi.folderId !== id),
    }));
    try {
      await repo.deleteFolder(id);
    } catch (e) {
      console.error("removeFolder failed:", e);
    }
  },

  // ─── Folder items ─────────────────────────────────────────────────────────

  addToFolder: async (productId, folderId, notes) => {
    const userId = get().userId;
    if (!userId) return;
    const existing = get().folderItems.find(
      (fi) => fi.productId === productId && fi.folderId === folderId,
    );
    if (existing) return;

    // Optimistic insert with temp id; replace on success
    const tmp = tempId("fi");
    const optimistic: FolderItem = {
      id: tmp,
      folderId,
      productId,
      notes,
      tags: [],
      dateAdded: new Date().toISOString(),
    };
    set((s) => ({
      folderItems: [...s.folderItems, optimistic],
      products: s.products.map((p) =>
        p.id === productId && p.status !== "saved" ? { ...p, status: "saved" } : p,
      ),
    }));

    try {
      const real = await repo.addToFolder(userId, productId, folderId, notes);
      if (real) {
        set((s) => ({
          folderItems: s.folderItems.map((fi) => (fi.id === tmp ? real : fi)),
        }));
      } else {
        // Already existed server-side (race) — drop the temp.
        set((s) => ({ folderItems: s.folderItems.filter((fi) => fi.id !== tmp) }));
      }
    } catch (e) {
      console.error("addToFolder failed:", e);
      set((s) => ({ folderItems: s.folderItems.filter((fi) => fi.id !== tmp) }));
    }
  },

  removeFromFolder: async (folderItemId) => {
    set((s) => ({
      folderItems: s.folderItems.filter((fi) => fi.id !== folderItemId),
    }));
    try {
      // Don't try to delete temp ids that never made it server-side.
      if (!folderItemId.startsWith("tmp-")) {
        await repo.removeFolderItem(folderItemId);
      }
    } catch (e) {
      console.error("removeFromFolder failed:", e);
    }
  },

  updateFolderItem: async (id, patch) => {
    set((s) => ({
      folderItems: s.folderItems.map((fi) =>
        fi.id === id ? { ...fi, ...patch } : fi,
      ),
    }));
    try {
      if (!id.startsWith("tmp-")) {
        await repo.updateFolderItemRow(id, patch);
      }
    } catch (e) {
      console.error("updateFolderItem failed:", e);
    }
  },

  // ─── Ingestion ────────────────────────────────────────────────────────────

  addIngestedProducts: async (sourceId, retailer, incoming) => {
    try {
      const result = await repo.ingestProducts(sourceId, retailer, incoming);
      set((s) => ({
        products: [...s.products, ...result.added],
        sources: s.sources.map((src) =>
          src.id === sourceId
            ? {
                ...src,
                lastIngestAt: new Date().toISOString(),
                lastIngestCount: result.added.length,
              }
            : src,
        ),
      }));
      return { added: result.added.length, skipped: result.skipped };
    } catch (e) {
      console.error("addIngestedProducts failed:", e);
      return { added: 0, skipped: incoming.length };
    }
  },

  // ─── Admin ────────────────────────────────────────────────────────────────

  resetAll: async () => {
    const userId = get().userId;
    if (!userId) return;
    try {
      await repo.resetAllData(userId);
      // Reset only clears this user's per-user data (folders, swipes,
      // saved/skipped state). Shared sources and products stay intact —
      // products reappear with status "new" since user_product_states is
      // wiped.
      set((s) => ({
        products: s.products.map((p) => ({ ...p, status: "new" })),
        folders: [],
        folderItems: [],
        recentSwipes: [],
        filter: defaultFilter,
      }));
    } catch (e) {
      console.error("resetAll failed:", e);
    }
  },

  signOut: async () => {
    try {
      await repo.signOut();
    } catch (e) {
      console.error("signOut failed:", e);
    }
    get().reset();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },
}));

// ─── Derived selectors ────────────────────────────────────────────────────────

export const selectFolderProductCount = (folderId: string) => (s: StoreState) =>
  s.folderItems.filter((fi) => fi.folderId === folderId).length;
