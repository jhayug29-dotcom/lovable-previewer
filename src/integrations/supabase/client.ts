import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://wylcbblegcyzunychqqa.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTA0OTgsImV4cCI6MjEwMDYyNjQ5OH0.dkFbE5steNuvDJtor-DSAyWHaTHjSMk0Uwa6RXasaFg";

/** Project URL + publishable key are safe in client code and must be supplied by the host environment. */
const url = (import.meta.env["VITE_SUPABASE_URL"] ??
  import.meta.env["SUPABASE_URL"] ??
  import.meta.env["STORE_SUPABASE_URL"] ??
  DEFAULT_URL) as string;

const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ??
  import.meta.env["SUPABASE_PUBLISHABLE_KEY"] ??
  import.meta.env["SUPABASE_ANON_KEY"] ??
  import.meta.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ??
  DEFAULT_ANON_KEY) as string;

/** True only when the host supplied a complete Supabase client configuration. */
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

/** Throws a friendly error instead of crashing when the backend isn't connected yet. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }
  return supabase;
}
