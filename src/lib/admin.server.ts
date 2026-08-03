import { adminClient, requireAdmin } from "./supabase.server";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  roleRowId: string | null;
};

/** True only when the bearer token belongs to an account holding the `admin` role. */
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
  await requireAdmin(accessToken);
  const client = adminClient();

  const { data: authData, error: authError } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (authError) throw authError;

  const { data: roleRows, error: roleError } = await client
    .from("user_roles")
    .select("id, user_id, role")
    .eq("role", "admin");
  if (roleError) throw roleError;

  const adminById = new Map((roleRows ?? []).map((r) => [r.user_id as string, r.id as string]));

  return authData.users.map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    fullName: (u.user_metadata?.['full_name'] as string | undefined) ?? null,
    isAdmin: adminById.has(u.id),
    roleRowId: adminById.get(u.id) ?? null,
  }));
}

/** Grant the admin role to another account. Admin-only. */
export async function grantAdmin(accessToken: string | undefined, userId: string) {
  await requireAdmin(accessToken);
  const { error } = await adminClient()
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw error;
  return { ok: true };
}

/** Remove the admin role from an account. Admin-only; cannot remove your own. */
export async function revokeAdmin(accessToken: string | undefined, userId: string) {
  const me = await requireAdmin(accessToken);
  if (me.id === userId) throw new Error("You cannot remove your own admin access");
  const { error } = await adminClient().from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
  if (error) throw error;
  return { ok: true };
}
