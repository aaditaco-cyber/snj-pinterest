"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser-side Supabase client. Singleton — same instance across the tab. */
export function getSupabaseBrowser() {
  if (!client) {
    const { url, anonKey } = requireSupabaseEnv();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
