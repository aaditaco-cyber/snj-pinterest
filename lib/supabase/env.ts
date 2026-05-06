/**
 * Centralized env access. If Supabase isn't configured yet, surface a clear
 * error rather than letting the app render with undefined creds.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseEnv(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See README.",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

export function requireSupabaseServiceRole(): { url: string; serviceKey: string } {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Service-role env vars missing. SUPABASE_SERVICE_ROLE_KEY must be set for server-side operations like cron.",
    );
  }
  return { url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
}
