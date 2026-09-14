import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

/** Resolve the deployment's single Supabase project. No repository fallbacks. */
export function getSupabaseUrl(): string {
  const url =
    getEnv("SUPABASE_URL") ??
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("STORE_SUPABASE_URL");

  if (!url) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and VITE_SUPABASE_URL in the deployment environment.",
    );
  }
  return url;
}

/** Browser-safe publishable/anon key for user-scoped requests. */
export function getSupabaseKey(): string {
  const key =
    getEnv("SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("STORE_SUPABASE_PUBLISHABLE_KEY");

  if (!key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment.",
    );
  }
  return key;
}

/** Server-only privileged key. Never hard-code this in source. */
export function getServiceRoleKey(): string | undefined {
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("STORE_SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("SUPABASE_SERVICE_KEY");

  return key && key !== "sb_secret_xxx" ? key : undefined;
}

export function isSupabaseServerConfigured(): boolean {
  try {
    getSupabaseUrl();
    getSupabaseKey();
    return true;
  } catch {
    return false;
  }
}

/** Service-role client for trusted server operations. */
export function adminClient(): SupabaseClient {
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing in the deployment environment. Privileged server operations cannot run safely.",
    );
  }

  return createClient(getSupabaseUrl(), serviceKey, {
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
