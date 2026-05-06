import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServiceRole } from "./env";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client. BYPASSES RLS — use only on the server, never
 * expose to the browser. Used by the cron route to write ingested products
 * across all users.
 */
export function getSupabaseService() {
  const { url, serviceKey } = requireSupabaseServiceRole();
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
