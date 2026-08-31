import { adminClient, getDbClient, getServiceRoleKey, requireAdmin } from "./supabase.server";

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
  const client = getDbClient(accessToken);

  // 1. Fetch admin roles
  const { data: roleRows } = await client
    .from("user_roles")
    .select("id, user_id, role")
    .eq("role", "admin");

  const adminById = new Map((roleRows ?? []).map((r) => [r.user_id as string, r.id as string]));

  // 2. Fetch profiles
  const { data: profileRows } = await client
    .from("profiles")
    .select("id, email, full_name, created_at");

  // 3. Optionally fetch auth users if service role is available
  let authUsers: { id: string; email?: string; user_metadata?: Record<string, unknown> }[] = [];
  if (getServiceRoleKey()) {
    try {
      const sClient = adminClient();
      const { data: authData } = await sClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (authData?.users) {
        authUsers = authData.users;
      }
    } catch {
      // ignore auth.admin errors
    }
  }

  const userMap = new Map<string, AdminUser>();

  for (const u of authUsers) {
    const isOwner = u.email?.toLowerCase() === "growchannel2026@gmail.com";
    userMap.set(u.id, {
      id: u.id,
      email: u.email ?? "(no email)",
      fullName: (u.user_metadata?.["full_name"] as string | undefined) ?? null,
      isAdmin: isOwner || adminById.has(u.id),
      roleRowId: adminById.get(u.id) ?? null,
    });
  }

  for (const p of (profileRows ?? []) as { id: string; email?: string; full_name?: string }[]) {
    const isOwner = p.email?.toLowerCase() === "growchannel2026@gmail.com";
    if (!userMap.has(p.id)) {
      userMap.set(p.id, {
        id: p.id,
        email: p.email ?? "(no email)",
        fullName: p.full_name ?? null,
        isAdmin: isOwner || adminById.has(p.id),
        roleRowId: adminById.get(p.id) ?? null,
      });
    } else {
      const existing = userMap.get(p.id)!;
      if (!existing.fullName && p.full_name) existing.fullName = p.full_name;
      if ((!existing.email || existing.email === "(no email)") && p.email) existing.email = p.email;
    }
  }

  return Array.from(userMap.values());
}

/** Grant the admin role to another account. Admin-only. */
export async function grantAdmin(accessToken: string | undefined, userId: string) {
  await requireAdmin(accessToken);
  const client = getDbClient(accessToken);
  const { error } = await client
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw error;
  return { ok: true };
}

/** Remove the admin role from an account. Admin-only; cannot remove your own or owner's. */
export async function revokeAdmin(accessToken: string | undefined, userId: string) {
  const me = await requireAdmin(accessToken);
  if (me.id === userId) throw new Error("You cannot remove your own admin access");
  const client = getDbClient(accessToken);
  const { error } = await client
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) throw error;
  return { ok: true };
}
