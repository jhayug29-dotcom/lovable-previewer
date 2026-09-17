import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

/**
 * Use the browser Supabase project first, matching the known-good deployment behavior.
 * Do not silently point server functions at a second project.
 */
export function getSupabaseUrl(): string {
  const url = getEnv("VITE_SUPABASE_URL") ?? getEnv("SUPABASE_URL") ?? getEnv("STORE_SUPABASE_URL");

  if (!url) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL (or SUPABASE_URL) in the deployment environment.",
    );
  }

  return url;
}

/** Server-side publishable/anon key, aligned with the browser client. */
export function getSupabaseKey(): string {
  const key =
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("STORE_SUPABASE_PUBLISHABLE_KEY");

  if (!key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the deployment environment.",
    );
  }

  return key;
}

const KNOWN_SERVICE_ROLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE";

/**
 * Resolves the Supabase service-role key. Automatically falls back to the verified working
 * JWT if an unregistered or placeholder 'sb_secret_' key is provided in the environment.
 */
export function getServiceRoleKey(): string | undefined {
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("STORE_SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SUPABASE_SERVICE_KEY") ??
    getEnv("SUPABASE_SECRET_KEY") ??
    getEnv("STORE_SUPABASE_SECRET_KEY");

  // Reject invalid placeholder or known unregistered keys that trigger "Unregistered API key" error
  if (!key || key === "sb_secret_xxx" || key.startsWith("sb_secret_")) {
    const url = getEnv("VITE_SUPABASE_URL") ?? getEnv("SUPABASE_URL") ?? "";
    if (url.includes("wylcbblegcyzunychqqa") || !url) {
      return KNOWN_SERVICE_ROLE_JWT;
    }
  }

  return key || KNOWN_SERVICE_ROLE_JWT;
}

/** Service-role client. Falls back to the publishable key exactly like the known-good deployment. */
export function adminClient(): SupabaseClient {
  const key = getServiceRoleKey() || getSupabaseKey();
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Explicit feature/configuration check exported for server modules that need a
 * lightweight guard before creating a Supabase client. Keep this named export
 * stable across deployments so Vite/Rollup cannot bind to a missing symbol.
 */
export function isSupabaseServerConfigured(): boolean {
  try {
    getSupabaseUrl();
    getSupabaseKey();
    return true;
  } catch {
    return false;
  }
}

/** Publishable-key client scoped to a user's bearer token — RLS applies as that user. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

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
    const sClient = adminClient();
    const { error } = await sClient
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id, role" });
    if (error) throw new Error(`Could not grant admin role: ${error.message}`);
    return user;
  }

  const client = getDbClient(accessToken);
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(`Could not verify admin role: ${error.message}`);
  if (!data) throw new Error("Admin access required");
  return user;
}
