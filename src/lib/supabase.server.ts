import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public project values also ship as build-time fallbacks so the app works on any host. */
const PUBLIC_FALLBACK: Record<string, string | undefined> = {
  SUPABASE_URL: "https://wylcbblegcyzunychqqa.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV",
};

function env(name: string): string {
  const value =
    process.env[name] ?? process.env[`STORE_${name}`] ?? PUBLIC_FALLBACK[name];
  if (!value) {
    throw new Error(
      "The store backend isn't connected yet. Add the Supabase environment variables " +
        `(missing: ${name}) and reload — checkout, accounts and the admin panel will work straight away.`,
    );
  }
  return value;
}


/** Service-role client — bypasses RLS. Server-only, privileged work only. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
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
  const { data } = await adminClient()
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access required");
  return user;
}
