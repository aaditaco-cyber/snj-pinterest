export type ProductStatus = "new" | "skipped" | "saved" | "archived";

export type JewelryCategory =
  | "earrings"
  | "bracelets"
  | "necklaces"
  | "rings"
  | "bridal"
  | "gemstone"
  | "tennis"
  | "pendants"
  | "other";

export interface Product {
  id: string;
  title: string;
  imageUrl: string;
  additionalImages?: string[];
  productUrl: string;
  retailer: string;
  sourceId?: string;
  price?: number;
  priceDisplay?: string;
  category: JewelryCategory;
  metalType?: string;
  caratWeight?: string;
  stoneType?: string;
  dateDiscovered: string;
  sourceUrl?: string;
  status: ProductStatus;
}

export type SourcePlatform = "shopify" | "custom" | "unknown";

export interface Source {
  id: string;
  name: string;
  url: string;
  /** URL the ingestion adapter actually hits — set during onboarding detection. */
  feedUrl?: string;
  /** Detected platform for this source. "unknown" means automated ingestion is not yet wired up. */
  platform?: SourcePlatform;
  category?: JewelryCategory;
  notes?: string;
  active: boolean;
  dateAdded: string;
  lastIngestAt?: string;
  lastIngestCount?: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
  archived?: boolean;
  dateCreated: string;
}

export interface FolderItem {
  id: string;
  folderId: string;
  productId: string;
  notes?: string;
  tags?: string[];
  dateAdded: string;
}

export interface SwipeAction {
  productId: string;
  action: "skip" | "save";
  timestamp: string;
  folderIds?: string[];
}

export type SortMode = "newest" | "oldest" | "price-low" | "price-high";

export interface FilterState {
  category: JewelryCategory | "all";
  sort: SortMode;
  retailer: string | "all";
  priceMin?: number;
  priceMax?: number;
}
