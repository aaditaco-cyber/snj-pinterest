import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEED_FOLDERS, SEED_PRODUCTS, SEED_SOURCES } from "./seed";
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
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface StoreState {
  hydrated: boolean;
  products: Product[];
  sources: Source[];
  folders: Folder[];
  folderItems: FolderItem[];
  recentSwipes: SwipeAction[];
  filter: FilterState;

  setHydrated: () => void;

  // Filter
  setFilter: (next: Partial<FilterState>) => void;

  // Swipe / status
  skipProduct: (productId: string) => void;
  saveProduct: (productId: string, folderIds?: string[], notes?: string) => void;
  undoLastSwipe: () => void;
  restoreSkippedProduct: (productId: string) => void;
  restoreAllSkipped: () => void;

  // Products
  addProduct: (p: Omit<Product, "id" | "dateDiscovered" | "status"> & { status?: Product["status"] }) => string;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;

  // Folders
  addFolder: (input: { name: string; color: string; icon?: string }) => string;
  updateFolder: (id: string, patch: Partial<Folder>) => void;
  archiveFolder: (id: string) => void;
  removeFolder: (id: string) => void;
  reorderFolders: (orderedIds: string[]) => void;

  // FolderItems
  addToFolder: (productId: string, folderId: string, notes?: string) => void;
  removeFromFolder: (folderItemId: string) => void;
  updateFolderItem: (id: string, patch: Partial<FolderItem>) => void;

  // Sources
  addSource: (input: {
    name: string;
    url: string;
    feedUrl?: string;
    platform?: SourcePlatform;
    category?: JewelryCategory;
    notes?: string;
  }) => string;
  updateSource: (id: string, patch: Partial<Source>) => void;
  toggleSourceActive: (id: string) => void;
  removeSource: (id: string) => void;

  // Ingestion
  addIngestedProducts: (
    sourceId: string,
    retailer: string,
    products: IngestProduct[],
  ) => { added: number; skipped: number };
  clearUnreviewedSeedProducts: () => number;

  // Admin
  resetAll: () => void;
}

const defaultFilter: FilterState = {
  category: "all",
  sort: "newest",
  retailer: "all",
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      products: SEED_PRODUCTS,
      sources: SEED_SOURCES,
      folders: SEED_FOLDERS,
      folderItems: [],
      recentSwipes: [],
      filter: defaultFilter,

      setHydrated: () => set({ hydrated: true }),

      setFilter: (next) => set((s) => ({ filter: { ...s.filter, ...next } })),

      skipProduct: (productId) =>
        set((s) => {
          const swipe: SwipeAction = {
            productId,
            action: "skip",
            timestamp: new Date().toISOString(),
          };
          return {
            products: s.products.map((p) =>
              p.id === productId ? { ...p, status: "skipped" } : p,
            ),
            recentSwipes: [swipe, ...s.recentSwipes].slice(0, MAX_RECENT_SWIPES),
          };
        }),

      saveProduct: (productId, folderIds = [], notes) =>
        set((s) => {
          const now = new Date().toISOString();
          const newItems: FolderItem[] = folderIds.map((folderId) => ({
            id: newId("fi"),
            folderId,
            productId,
            notes,
            dateAdded: now,
          }));
          const swipe: SwipeAction = {
            productId,
            action: "save",
            timestamp: now,
            folderIds,
          };
          return {
            products: s.products.map((p) =>
              p.id === productId ? { ...p, status: "saved" } : p,
            ),
            folderItems: [...s.folderItems, ...newItems],
            recentSwipes: [swipe, ...s.recentSwipes].slice(0, MAX_RECENT_SWIPES),
          };
        }),

      undoLastSwipe: () =>
        set((s) => {
          const [last, ...rest] = s.recentSwipes;
          if (!last) return {};
          return {
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
            recentSwipes: rest,
          };
        }),

      restoreSkippedProduct: (productId) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId && p.status === "skipped"
              ? { ...p, status: "new" }
              : p,
          ),
        })),

      restoreAllSkipped: () =>
        set((s) => ({
          products: s.products.map((p) =>
            p.status === "skipped" ? { ...p, status: "new" } : p,
          ),
        })),

      addProduct: (input) => {
        const id = newId("p");
        set((s) => ({
          products: [
            ...s.products,
            {
              ...input,
              id,
              dateDiscovered: new Date().toISOString(),
              status: input.status ?? "new",
            },
          ],
        }));
        return id;
      },

      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removeProduct: (id) =>
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          folderItems: s.folderItems.filter((fi) => fi.productId !== id),
        })),

      addFolder: ({ name, color, icon }) => {
        const id = newId("fld");
        set((s) => ({
          folders: [
            ...s.folders,
            {
              id,
              name,
              color,
              icon,
              order: s.folders.length,
              dateCreated: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      updateFolder: (id, patch) =>
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      archiveFolder: (id) =>
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id ? { ...f, archived: !f.archived } : f,
          ),
        })),

      removeFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          folderItems: s.folderItems.filter((fi) => fi.folderId !== id),
        })),

      reorderFolders: (orderedIds) =>
        set((s) => ({
          folders: s.folders.map((f) => {
            const order = orderedIds.indexOf(f.id);
            return order >= 0 ? { ...f, order } : f;
          }),
        })),

      addToFolder: (productId, folderId, notes) =>
        set((s) => {
          const existing = s.folderItems.find(
            (fi) => fi.productId === productId && fi.folderId === folderId,
          );
          if (existing) return {};
          return {
            folderItems: [
              ...s.folderItems,
              {
                id: newId("fi"),
                folderId,
                productId,
                notes,
                dateAdded: new Date().toISOString(),
              },
            ],
            products: s.products.map((p) =>
              p.id === productId && p.status !== "saved"
                ? { ...p, status: "saved" }
                : p,
            ),
          };
        }),

      removeFromFolder: (folderItemId) =>
        set((s) => ({
          folderItems: s.folderItems.filter((fi) => fi.id !== folderItemId),
        })),

      updateFolderItem: (id, patch) =>
        set((s) => ({
          folderItems: s.folderItems.map((fi) =>
            fi.id === id ? { ...fi, ...patch } : fi,
          ),
        })),

      addSource: (input) => {
        const id = newId("src");
        set((s) => ({
          sources: [
            ...s.sources,
            { ...input, id, active: true, dateAdded: new Date().toISOString() },
          ],
        }));
        return id;
      },

      updateSource: (id, patch) =>
        set((s) => ({
          sources: s.sources.map((src) =>
            src.id === id ? { ...src, ...patch } : src,
          ),
        })),

      toggleSourceActive: (id) =>
        set((s) => ({
          sources: s.sources.map((src) =>
            src.id === id ? { ...src, active: !src.active } : src,
          ),
        })),

      removeSource: (id) =>
        set((s) => ({
          sources: s.sources.filter((src) => src.id !== id),
        })),

      addIngestedProducts: (sourceId, retailer, incoming) => {
        let added = 0;
        let skipped = 0;
        const now = new Date().toISOString();
        set((s) => {
          const existingUrls = new Set(s.products.map((p) => p.productUrl));
          const newProducts: Product[] = [];
          for (const ip of incoming) {
            if (!ip.productUrl || existingUrls.has(ip.productUrl)) {
              skipped++;
              continue;
            }
            existingUrls.add(ip.productUrl);
            newProducts.push({
              ...ip,
              id: newId("p"),
              sourceId,
              dateDiscovered: now,
              status: "new",
            });
            added++;
          }
          return {
            products: [...s.products, ...newProducts],
            sources: s.sources.map((src) =>
              src.id === sourceId
                ? { ...src, lastIngestAt: now, lastIngestCount: added }
                : src,
            ),
          };
        });
        return { added, skipped };
      },

      clearUnreviewedSeedProducts: () => {
        const seedIdPattern = /^p-\d{3}$/;
        let removed = 0;
        set((s) => {
          const next = s.products.filter((p) => {
            const isSeed = seedIdPattern.test(p.id);
            const isUnreviewed = p.status === "new";
            if (isSeed && isUnreviewed) {
              removed++;
              return false;
            }
            return true;
          });
          return { products: next };
        });
        return removed;
      },

      resetAll: () =>
        set({
          products: SEED_PRODUCTS,
          sources: SEED_SOURCES,
          folders: SEED_FOLDERS,
          folderItems: [],
          recentSwipes: [],
          filter: defaultFilter,
        }),
    }),
    {
      name: "snj-pinterest-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        products: s.products,
        sources: s.sources,
        folders: s.folders,
        folderItems: s.folderItems,
        recentSwipes: s.recentSwipes,
        filter: s.filter,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

// ─── Derived selectors ────────────────────────────────────────────────────────

export const selectFolderProductCount = (folderId: string) => (s: StoreState) =>
  s.folderItems.filter((fi) => fi.folderId === folderId).length;

export const selectProductsInFolder =
  (folderId: string) => (s: StoreState): { item: FolderItem; product: Product }[] => {
    const items = s.folderItems.filter((fi) => fi.folderId === folderId);
    const byId = new Map(s.products.map((p) => [p.id, p]));
    return items
      .map((item) => {
        const product = byId.get(item.productId);
        return product ? { item, product } : null;
      })
      .filter((x): x is { item: FolderItem; product: Product } => x !== null);
  };

export const selectFoldersForProduct =
  (productId: string) => (s: StoreState): Folder[] => {
    const folderIds = new Set(
      s.folderItems.filter((fi) => fi.productId === productId).map((fi) => fi.folderId),
    );
    return s.folders.filter((f) => folderIds.has(f.id));
  };
