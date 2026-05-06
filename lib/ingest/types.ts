import type { Product } from "../types";

export type SourcePlatform = "shopify" | "custom" | "unknown";

export interface DetectionSuccess {
  ok: true;
  platform: SourcePlatform;
  feedUrl: string;
  productCount: number;
  samples: IngestProduct[];
}

export interface DetectionFailure {
  ok: false;
  platform: SourcePlatform;
  reason: string;
}

export type DetectionResult = DetectionSuccess | DetectionFailure;

// What an adapter produces — same shape as Product but without store-assigned fields.
export type IngestProduct = Omit<Product, "id" | "dateDiscovered" | "status" | "sourceId">;
