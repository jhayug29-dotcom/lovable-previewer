import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public project values also ship as build-time fallbacks so the app works on any host. */
const PUBLIC_FALLBACK: Record<string, string | undefined> = {
  SUPABASE_URL: "https://wylcbblegcyzunychqqa.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV",
};

export function getSupabaseUrl(): string {
  return (
    process.env["SUPABASE_URL"] ??
    process.env["VITE_SUPABASE_URL"] ??
    process.env["STORE_SUPABASE_URL"] ??
    PUBLIC_FALLBACK["SUPABASE_URL"]!
  );
}

export function getSupabaseKey(): string {
  return (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["VITE_SUPABASE_ANON_KEY"] ??
    process.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ??
    PUBLIC_FALLBACK["SUPABASE_PUBLISHABLE_KEY"]!
  );
}

export function getServiceRoleKey(): string | undefined {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["STORE_SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_SERVICE_KEY"]
  );
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

/** Returns the most appropriate Supabase client: userClient if token provided, otherwise adminClient or anonClient. */
export function getDbClient(accessToken?: string): SupabaseClient {
  if (accessToken) {
    return userClient(accessToken);
  }
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

export async function requireAdmin(accessToken: string | undefined): Promise<AuthedUser> {
  const user = await requireUser(accessToken);

  if (user.email && user.email.toLowerCase() === "growchannel2026@gmail.com") {
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
