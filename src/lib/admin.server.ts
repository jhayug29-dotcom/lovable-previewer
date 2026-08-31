import {
  adminClient,
  requireAdmin,
  isMasterAdminEmail,
  MASTER_ADMIN_EMAILS,
} from "./supabase.server";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  roleRowId: string | null;
};

/** True only when the bearer token belongs to an account holding the `admin` role or master email. */
export async function isAdminToken(accessToken: string | undefined): Promise<boolean> {
  if (!accessToken) return false;
  try {
    await requireAdmin(accessToken);
    return true;
  } catch {
    return false;
  }
}

/** Every signed-up account plus its admin state. Admin-only. */
export async function listUsers(accessToken: string | undefined): Promise<AdminUser[]> {
  const me = await requireAdmin(accessToken);
  const client = adminClient();

  let usersList: { id: string; email?: string; user_metadata?: Record<string, unknown> }[] = [];

  try {
    const { data: authData, error: authError } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authError) throw authError;
    usersList = authData?.users ?? [];
  } catch (err) {
    console.warn("auth.admin.listUsers fallback to profiles:", err);
    // Fallback: query public.profiles if auth.admin fails
    const { data: profileRows } = await client.from("profiles").select("id, email, full_name");
    if (profileRows && profileRows.length > 0) {
      usersList = profileRows.map((p) => ({
        id: p.id,
        email: p.email,
        user_metadata: { full_name: p.full_name },
      }));
    } else {
      usersList = [
        {
          id: me.id,
          email: me.email ?? "yjha019@gmail.com",
          user_metadata: { full_name: "Admin" },
        },
      ];
    }
  }

  const { data: roleRows } = await client
    .from("user_roles")
    .select("id, user_id, role")
    .eq("role", "admin");

  const adminById = new Map((roleRows ?? []).map((r) => [r.user_id as string, r.id as string]));

  return usersList.map((u) => {
    const email = u.email ?? "(no email)";
    const isMaster = isMasterAdminEmail(email);
    const hasAdminRole = adminById.has(u.id);
    return {
      id: u.id,
      email,
      fullName: (u.user_metadata?.["full_name"] as string | undefined) ?? null,
      isAdmin: isMaster || hasAdminRole,
      roleRowId: adminById.get(u.id) ?? (isMaster ? "master-admin" : null),
    };
  });
}

/** Grant the admin role to another account. Admin-only. */
export async function grantAdmin(accessToken: string | undefined, userId: string) {
  await requireAdmin(accessToken);
  const client =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STORE_SUPABASE_SERVICE_ROLE_KEY
      ? adminClient()
      : userClient(accessToken!);
  const { error } = await client
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw error;
  return { ok: true };
}

/** Remove the admin role from an account. Admin-only; cannot remove your own. */
export async function revokeAdmin(accessToken: string | undefined, userId: string) {
  const me = await requireAdmin(accessToken);
  if (me.id === userId) throw new Error("You cannot remove your own admin access");
  const client =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STORE_SUPABASE_SERVICE_ROLE_KEY
      ? adminClient()
      : userClient(accessToken!);
  const { error } = await client
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) throw error;
  return { ok: true };
}
