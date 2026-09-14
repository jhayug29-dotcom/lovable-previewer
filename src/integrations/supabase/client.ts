import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase configuration.
 *
 * Do not ship database credentials or fallback project keys in source code.
 * Vercel must provide the VITE_* variables at build time.
 */
const url = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim();
const key = String(
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    import.meta.env["VITE_SUPABASE_ANON_KEY"] ??
    "",
).trim();

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured in this deployment. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel and redeploy.",
    );
  }
  return supabase;
}
