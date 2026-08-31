import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public project values also ship as build-time fallbacks so the app works on any host. */
const PUBLIC_FALLBACK: Record<string, string | undefined> = {
  SUPABASE_URL: "https://wylcbblegcyzunychqqa.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV",
};

export const MASTER_ADMIN_EMAILS = [
  "yjha019@gmail.com",
  "growchannel2026@gmail.com",
  ...(process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : []),
];

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return MASTER_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === normalized);
}

function env(name: string): string {
  const value = process.env[name] ?? process.env[`STORE_${name}`] ?? PUBLIC_FALLBACK[name];
  if (!value) {
    throw new Error(
      "The store backend isn't connected yet. Add the Supabase environment variables " +
        `(missing: ${name}) and reload — checkout, accounts and the admin panel will work straight away.`,
    );
  }
  return value;
}

export function hasServiceRoleKey(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.STORE_SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key && key.trim().length > 0);
}

/** Publishable-key client for public queries (products, active sales, active coupons) */
export function publicClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client — bypasses RLS. Server-only, privileged work only. */
export function adminClient(): SupabaseClient {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.STORE_SUPABASE_SERVICE_ROLE_KEY ??
    PUBLIC_FALLBACK.SUPABASE_PUBLISHABLE_KEY;
  const url = env("SUPABASE_URL");
  return createClient(url, serviceKey ?? env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Publishable-key client scoped to a user's bearer token — RLS applies as that user. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Returns the best available authenticated database client:
 * 1. Admin/service-role client if service key exists (bypasses RLS).
 * 2. Scoped user client with Authorization header if accessToken is provided (RLS evaluates as user).
 * 3. Public client if neither is available.
 */
export function getDbClient(accessToken?: string | undefined): SupabaseClient {
  if (hasServiceRoleKey()) {
    return adminClient();
  }
  if (accessToken && accessToken.trim().length > 0) {
    return userClient(accessToken);
  }
  return publicClient();
}

export type AuthedUser = { id: string; email: string | undefined };

export async function requireUser(accessToken: string | undefined): Promise<AuthedUser> {
  if (!accessToken) throw new Error("Not signed in");
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Not signed in");
  return { id: data.user.id, email: data.user.email };
}

export async function requireAdmin(accessToken: string | undefined): Promise<AuthedUser> {
  const user = await requireUser(accessToken);
  if (isMasterAdminEmail(user.email)) {
    // Proactively try to ensure the role row exists in public.user_roles and profiles
    try {
      const client = adminClient();
      await client
        .from("profiles")
        .upsert({ id: user.id, email: user.email }, { onConflict: "id" });
      await client
        .from("user_roles")
        .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    } catch {
      // Ignore background sync errors
    }
    return user;
  }
  try {
    const { data } = await userClient(accessToken!)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (data) return user;
  } catch (err) {
    console.error("requireAdmin user_roles check:", err);
  }
  throw new Error("Admin access required");
}
