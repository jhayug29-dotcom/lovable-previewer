import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env might not exist or already loaded
  }
}

const DEFAULT_SUPABASE_URL = "https://wylcbblegcyzunychqqa.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTA0OTgsImV4cCI6MjEwMDYyNjQ5OH0.dkFbE5steNuvDJtor-DSAyWHaTHjSMk0Uwa6RXasaFg";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

export function isSupabaseServerConfigured(): boolean {
  const url =
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("SUPABASE_URL") ??
    getEnv("STORE_SUPABASE_URL") ??
    DEFAULT_SUPABASE_URL;
  const key =
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("STORE_SUPABASE_PUBLISHABLE_KEY") ??
    DEFAULT_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

/**
 * Use the same Supabase project configuration as the browser client first.
 * This prevents a stale SUPABASE_URL/SUPABASE_* variable on Vercel from
 * silently pointing server functions at a different Supabase project.
 */
export function getSupabaseUrl(): string {
  const url =
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("SUPABASE_URL") ??
    getEnv("STORE_SUPABASE_URL") ??
    DEFAULT_SUPABASE_URL;

  if (!url) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL (or SUPABASE_URL) in the deployment environment.",
    );
  }

  return url;
}

/** Server-side publishable/anon key. Keep it aligned with the browser client. */
export function getSupabaseKey(): string {
  const key =
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("STORE_SUPABASE_PUBLISHABLE_KEY") ??
    DEFAULT_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the deployment environment.",
    );
  }

  return key;
}

export function getServiceRoleKey(): string | undefined {
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("STORE_SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SUPABASE_SERVICE_KEY") ??
    DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

  if (!key || key === "sb_secret_xxx") {
    return undefined;
  }
  return key;
}

/** Service-role client — bypasses RLS when configured. Server-only, privileged work only. */
export function adminClient(): SupabaseClient {
  const serviceKey = getServiceRoleKey();
  const key = serviceKey || getSupabaseKey();
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Publishable-key client scoped to a user's bearer token — RLS applies as that user. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Returns the most appropriate Supabase client: userClient if token provided, otherwise adminClient. */
export function getDbClient(accessToken?: string): SupabaseClient {
  if (accessToken) return userClient(accessToken);
  return adminClient();
}

export type AuthedUser = { id: string; email: string | undefined };

export async function requireUser(accessToken: string | undefined): Promise<AuthedUser> {
  if (!accessToken) throw new Error("Not signed in");
  const client = createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Not signed in");
  return { id: data.user.id, email: data.user.email };
}

const KNOWN_ADMIN_EMAILS = new Set(["growchannel2026@gmail.com", "jhayug29@gmail.com"]);

export function isOwnerOrAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (KNOWN_ADMIN_EMAILS.has(normalized)) return true;
  const extra = process.env["ADMIN_EMAILS"] ?? process.env["VITE_ADMIN_EMAILS"];
  if (extra) {
    const list = extra.split(",").map((e) => e.trim().toLowerCase());
    if (list.includes(normalized)) return true;
  }
  return false;
}

export async function requireAdmin(accessToken: string | undefined): Promise<AuthedUser> {
  const user = await requireUser(accessToken);

  if (isOwnerOrAdminEmail(user.email)) {
    // Auto-grant the DB admin role if they are an owner, so RLS policies pass
    try {
      const sClient = adminClient();
      await sClient
        .from("user_roles")
        .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id, role" });
    } catch (e) {
      // Ignore errors if service role fails
    }
    return user;
  }

  const client = getDbClient(accessToken);
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!data) throw new Error("Admin access required");
  return user;
}
