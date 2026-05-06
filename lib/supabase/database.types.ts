/**
 * Hand-rolled types matching supabase/schema.sql.
 *
 * Once the Supabase project is live, you can regenerate these from the live
 * schema with:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
 */

export type Database = {
  public: {
    Tables: {
      sources: {
        Row: SourceRow;
        Insert: SourceInsert;
        Update: SourceUpdate;
        Relationships: [];
      };
      folders: {
        Row: FolderRow;
        Insert: FolderInsert;
        Update: FolderUpdate;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
        Relationships: [];
      };
      folder_items: {
        Row: FolderItemRow;
        Insert: FolderItemInsert;
        Update: FolderItemUpdate;
        Relationships: [];
      };
      swipe_actions: {
        Row: SwipeActionRow;
        Insert: SwipeActionInsert;
        Update: Partial<SwipeActionInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type SourceRow = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  feed_url: string | null;
  platform: "shopify" | "custom" | "unknown" | null;
  freshness_window_days: number;
  category: string | null;
  notes: string | null;
  active: boolean;
  date_added: string;
  last_ingest_at: string | null;
  last_ingest_count: number | null;
};
export type SourceInsert = {
  id?: string;
  user_id: string;
  name: string;
  url: string;
  feed_url?: string | null;
  platform?: "shopify" | "custom" | "unknown" | null;
  freshness_window_days?: number;
  category?: string | null;
  notes?: string | null;
  active?: boolean;
  date_added?: string;
  last_ingest_at?: string | null;
  last_ingest_count?: number | null;
};
export type SourceUpdate = Partial<SourceInsert>;

export type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  archived: boolean;
  date_created: string;
};
export type FolderInsert = {
  id?: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string | null;
  order?: number;
  archived?: boolean;
  date_created?: string;
};
export type FolderUpdate = Partial<FolderInsert>;

export type ProductRow = {
  id: string;
  user_id: string;
  source_id: string | null;
  title: string;
  image_url: string | null;
  additional_images: string[];
  product_url: string;
  retailer: string | null;
  price: number | null;
  price_display: string | null;
  category: string | null;
  metal_type: string | null;
  carat_weight: string | null;
  stone_type: string | null;
  source_url: string | null;
  status: "new" | "skipped" | "saved" | "archived";
  date_discovered: string;
};
export type ProductInsert = {
  id?: string;
  user_id: string;
  source_id?: string | null;
  title: string;
  image_url?: string | null;
  additional_images?: string[];
  product_url: string;
  retailer?: string | null;
  price?: number | null;
  price_display?: string | null;
  category?: string | null;
  metal_type?: string | null;
  carat_weight?: string | null;
  stone_type?: string | null;
  source_url?: string | null;
  status?: "new" | "skipped" | "saved" | "archived";
  date_discovered?: string;
};
export type ProductUpdate = Partial<ProductInsert>;

export type FolderItemRow = {
  id: string;
  user_id: string;
  folder_id: string;
  product_id: string;
  notes: string | null;
  tags: string[];
  date_added: string;
};
export type FolderItemInsert = {
  id?: string;
  user_id: string;
  folder_id: string;
  product_id: string;
  notes?: string | null;
  tags?: string[];
  date_added?: string;
};
export type FolderItemUpdate = Partial<FolderItemInsert>;

export type SwipeActionRow = {
  id: string;
  user_id: string;
  product_id: string;
  action: "skip" | "save";
  folder_ids: string[];
  timestamp: string;
};
export type SwipeActionInsert = {
  id?: string;
  user_id: string;
  product_id: string;
  action: "skip" | "save";
  folder_ids?: string[];
  timestamp?: string;
};
