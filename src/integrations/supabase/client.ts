import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Project URL + publishable key are safe in client code; env vars override them on any host. */
const FALLBACK_URL = "https://wylcbblegcyzunychqqa.supabase.co";
const FALLBACK_KEY = "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? FALLBACK_URL;
const key =
  ((import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined) ?? FALLBACK_KEY;

/** True once the Supabase project is connected via Project Settings → Integrations. */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Throws a friendly error instead of crashing when the backend isn't connected yet. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Backend not connected yet. Connect your Supabase project in Project Settings → Integrations.",
    );
  }
  return supabase;
}
