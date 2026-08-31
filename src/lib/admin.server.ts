import {
  adminClient,
  userClient,
  getDbClient,
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
  const db = getDbClient(accessToken);

  type RawUser = {
    id: string;
    email?: string;
    fullName?: string | null;
    createdAt?: string;
  };

  const userMap = new Map<string, RawUser>();

  // 1. Try auth.admin.listUsers if privileged client available
  try {
    const { data: authData, error: authError } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    if (!authError && authData?.users) {
      for (const u of authData.users) {
        if (u.id) {
          const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
          userMap.set(u.id, {
            id: u.id,
            email: u.email,
            fullName:
              (meta["full_name"] as string | undefined) ??
              (meta["name"] as string | undefined) ??
              null,
            createdAt: u.created_at,
          });
        }
      }
    }
  } catch {
    // Non-privileged client fallback
  }

  // 2. Query public.profiles
  try {
    const { data: profileRows } = await db
      .from("profiles")
      .select("id, email, full_name, created_at");
    if (profileRows) {
      for (const p of profileRows as {
        id: string;
        email?: string;
        full_name?: string;
        created_at?: string;
      }[]) {
        const existing = userMap.get(p.id);
        if (!existing) {
          userMap.set(p.id, {
            id: p.id,
            email: p.email,
            fullName: p.full_name ?? null,
            createdAt: p.created_at,
          });
        } else if (!existing.fullName && p.full_name) {
          existing.fullName = p.full_name;
        }
      }
    }
  } catch (err) {
    console.warn("profiles query warning in listUsers:", err);
  }

  // 3. Include purchasing customer emails from orders if not in profiles
  try {
    const { data: orderRows } = await db
      .from("orders")
      .select("user_id, customer_email, customer_name, created_at")
      .order("created_at", { ascending: false });
    if (orderRows) {
      for (const o of orderRows as {
        user_id?: string | null;
        customer_email?: string | null;
        customer_name?: string | null;
        created_at?: string | null;
      }[]) {
        if (o.user_id && !userMap.has(o.user_id)) {
          userMap.set(o.user_id, {
            id: o.user_id,
            email: o.customer_email ?? undefined,
            fullName: o.customer_name ?? null,
            createdAt: o.created_at ?? undefined,
          });
        }
      }
    }
  } catch {
    // Ignore
  }

  // 4. Ensure current admin is always in list
  if (me.id && !userMap.has(me.id)) {
    userMap.set(me.id, {
      id: me.id,
      email: me.email ?? "admin@editly.store",
      fullName: "Admin",
    });
  }

  // 5. Query user roles
  let roleRows: { id: string; user_id: string; role: string }[] = [];
  try {
    const { data: roles } = await db
      .from("user_roles")
      .select("id, user_id, role")
      .eq("role", "admin");
    if (roles) {
      roleRows = roles as { id: string; user_id: string; role: string }[];
    }
  } catch (err) {
    console.warn("user_roles query warning in listUsers:", err);
  }

  const adminByUserId = new Map(roleRows.map((r) => [r.user_id, r.id]));

  return [...userMap.values()].map((u) => {
    const email = u.email ?? "(no email)";
    const isMaster = isMasterAdminEmail(email);
    const hasAdminRole = adminByUserId.has(u.id);
    return {
      id: u.id,
      email,
      fullName: u.fullName ?? null,
      isAdmin: isMaster || hasAdminRole,
      roleRowId: adminByUserId.get(u.id) ?? (isMaster ? "master-admin" : null),
    };
  });
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

/** Remove the admin role from an account. Admin-only; cannot remove your own. */
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
