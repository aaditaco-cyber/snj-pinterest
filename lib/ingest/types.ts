import type { Product } from "../types";

export type SourcePlatform = "shopify" | "custom" | "unknown";

export interface DetectionSuccess {
  ok: true;
  platform: SourcePlatform;
  feedUrl: string;
  /** Total products returned by the feed before any freshness filtering. */
  totalCount: number;
  /** Products within the freshness window (these are what an ingest will actually add). */
  inWindowCount: number;
  /** Days back the freshness filter looked. */
  windowDays: number;
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
