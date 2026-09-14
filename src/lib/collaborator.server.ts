import {
  adminClient,
  getDbClient,
  getServiceRoleKey,
  requireAdmin,
  requireUser,
} from "./supabase.server";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const makeCode = () =>
  `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

type DbClient = ReturnType<typeof getDbClient>;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
export type CollaboratorStats = {
  visitors: number;
  page_views: number;
  signups: number;
  sales: number;
  revenue: number;
};
export type CollaboratorLink = CollaboratorStats & {
  id: string;
  code: string;
  name: string;
  user_id: string;
  email: string;
  active: boolean;
  created_at: string;
  url: string;
};
export type CollaboratorPartner = {
  user_id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  links: CollaboratorLink[];
  product_ids: string[];
  products: Product[];
  totals: CollaboratorStats;
};

function adminDb(accessToken?: string): DbClient {
  if (accessToken) return getDbClient(accessToken);
  return adminClient();
}

async function getAuthorizedProductIds(db: DbClient, userId: string) {
  const { data, error } = await db
    .from("collaborator_partner_products")
    .select("product_id")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
}

async function getProducts(db: DbClient, ids?: string[]): Promise<Product[]> {
  let query = db
    .from("products")
    .select("id,title,category,price,active")
    .order("sort_order", { ascending: true });
  if (ids) query = query.in("id", ids.length ? ids : [EMPTY_UUID]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function statsForLink(
  db: DbClient,
  id: string,
  collaboratorCode: string,
  allowedProductIds?: string[],
): Promise<CollaboratorStats> {
  let visitors = 0;
  let page_views = 0;
  let signups = 0;
  let sales = 0;
  let revenue = 0;

  const attributedUserSet = new Set<string>();
  try {
    const filters = [
      `collaborator_code.eq.${collaboratorCode}`,
      `collaborator_link_id.eq.${id}`,
      `collaborator_code.eq.${id}`,
    ];

    const { data: views, error: viewError } = await db
      .from("page_views")
      .select("session_id, path, user_id, created_at")
      .or(filters.join(","))
      .limit(100000);

    if (!viewError && views) {
      page_views = views.length;
      const uniqueSessions = new Set(views.map((v) => v.session_id).filter(Boolean));
      visitors = uniqueSessions.size;
      for (const v of views) {
        if (v.user_id) attributedUserSet.add(v.user_id);
      }
      signups = attributedUserSet.size;
    }
  } catch (err) {
    console.warn("View stats fetch warning for link:", collaboratorCode, err);
  }

  // 2. Fetch Orders
  try {
    const { data: orders, error: orderError } = await db
      .from("orders")
      .select("id, product_id, amount, status, user_id, customer_email, collaborator_link_id, created_at")
      .limit(100000);

    if (!orderError && orders) {
      const allowed =
        allowedProductIds && allowedProductIds.length ? new Set(allowedProductIds) : null;
      const visible = (
        orders as {
          id: string;
          product_id: string | null;
          amount: number | string | null;
          status: string;
          user_id: string | null;
          customer_email: string | null;
          collaborator_link_id: string | null;
        }[]
      ).filter((order) => {
        const isPaid = PAID_STATUSES.has((order.status ?? "").toUpperCase());
        if (!isPaid) return false;

        const isDirect = order.collaborator_link_id === id;
        const isAttributedUser = order.user_id ? attributedUserSet.has(order.user_id) : false;
        if (!isDirect && !isAttributedUser) return false;

        if (allowed && order.product_id) {
          return allowed.has(order.product_id);
        }
        return true;
      });

      sales = visible.length;
      revenue = visible.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      const orderUsers = new Set(visible.map((o) => o.user_id).filter(Boolean));
      signups = Math.max(signups, orderUsers.size);
    }
  } catch (err) {
    console.warn("Order stats fetch warning for link:", id, err);
  }

  return {
    visitors,
    page_views,
    signups,
    sales,
    revenue,
  };
}

async function safeStatsForLink(
  db: DbClient,
  id: string,
  collaboratorCode: string,
  allowedProductIds?: string[],
): Promise<CollaboratorStats> {
  try {
    return await statsForLink(db, id, collaboratorCode, allowedProductIds);
  } catch (error) {
    console.error("Collaborator stats unavailable", error);
    return { visitors: 0, page_views: 0, signups: 0, sales: 0, revenue: 0 };
  }
}

async function buildLink(
  db: DbClient,
  row: {
    id: string;
    code: string;
    name: string;
    user_id: string;
    email: string;
    active: boolean;
    created_at: string;
  },
  ids?: string[],
) {
  return {
    ...row,
    url: `/?ref=${row.code}`,
    ...(await safeStatsForLink(db, row.id, row.code, ids)),
  };
}

export async function listCollaboratorProducts(accessToken?: string) {
  await requireAdmin(accessToken);
  return getProducts(adminDb(accessToken));
}

export async function listCollaboratorLinks(accessToken?: string): Promise<CollaboratorLink[]> {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const { data, error } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as Omit<CollaboratorLink, keyof CollaboratorStats | "url">[]).map(async (row) =>
      buildLink(db, row, await getAuthorizedProductIds(db, row.user_id)),
    ),
  );
}

export async function listCollaboratorPartners(
  accessToken?: string,
): Promise<CollaboratorPartner[]> {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const { data, error } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    code: string;
    name: string;
    user_id: string;
    email: string;
    active: boolean;
    created_at: string;
  }[];

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);

  const userIds = [...byUser.keys()];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from("profiles").select("id,email,full_name").in("id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));
  const result: CollaboratorPartner[] = [];

  for (const userId of userIds) {
    const productIds = await getAuthorizedProductIds(db, userId);
    const links = await Promise.all(
      (byUser.get(userId) ?? []).map((row) => buildLink(db, row, productIds)),
    );
    const totals = links.reduce(
      (sum, link) => ({
        visitors: sum.visitors + link.visitors,
        page_views: sum.page_views + link.page_views,
        signups: sum.signups + link.signups,
        sales: sum.sales + link.sales,
        revenue: sum.revenue + link.revenue,
      }),
      { visitors: 0, page_views: 0, signups: 0, sales: 0, revenue: 0 },
    );
    const profile = profileMap.get(userId);

    result.push({
      user_id: userId,
      email: profile?.email ?? links[0]?.email ?? "(unknown account)",
      full_name: (profile?.full_name as string | null) ?? null,
      active: links.some((link) => link.active),
      links,
      product_ids: productIds,
      // The admin UI uses its authenticated product catalog query for this list.
      // Avoid making the entire partner list fail because this secondary product read has an RLS/config issue.
      products: [],
      totals,
    });
  }

  return result;
}

export async function setCollaboratorProductAccess(
  accessToken: string | undefined,
  userId: string,
  productIds: string[],
) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const clean = [...new Set(productIds)];
  const { error: deleteError } = await db
    .from("collaborator_partner_products")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (clean.length) {
    const { data: validProducts, error: productError } = await db
      .from("products")
      .select("id")
      .in("id", clean);
    if (productError) throw productError;
    const validIds = new Set((validProducts ?? []).map((product) => product.id as string));
    const invalid = clean.filter((id) => !validIds.has(id));
    if (invalid.length) throw new Error("One or more selected products no longer exist");

    const { error } = await db
      .from("collaborator_partner_products")
      .insert(clean.map((product_id) => ({ user_id: userId, product_id })));
    if (error && error.code !== "23505") throw error;
  }

  return { ok: true, productIds: clean };
}

export async function createCollaboratorLink(
  accessToken: string | undefined,
  name: string,
  email?: string,
  userId?: string,
  productIds: string[] = [],
) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  let resolvedUserId = (userId ?? "").trim() || undefined;
  let resolvedEmail = (email ?? "").trim().toLowerCase();

  if (resolvedUserId) {
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,email")
      .eq("id", resolvedUserId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile) {
      resolvedEmail = (profile.email as string) || resolvedEmail;
    } else if (getServiceRoleKey()) {
      try {
        const { data } = await adminClient().auth.admin.getUserById(resolvedUserId);
        if (data.user) resolvedEmail = (data.user.email ?? resolvedEmail).toLowerCase();
      } catch {
        // Ignore user lookup error
      }
    }
    if (!resolvedEmail) throw new Error("The selected account has no email address");
  } else {
    if (!resolvedEmail) throw new Error("A registered user or email is required");
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,email")
      .ilike("email", resolvedEmail)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile) {
      resolvedUserId = profile.id as string;
      resolvedEmail = (profile.email as string) || resolvedEmail;
    } else if (getServiceRoleKey()) {
      const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const match = data.users.find((user) => (user.email ?? "").toLowerCase() === resolvedEmail);
      if (match) {
        resolvedUserId = match.id;
        resolvedEmail = (match.email ?? resolvedEmail).toLowerCase();
      }
    }
  }

  if (!resolvedUserId) throw new Error("No registered user was found for that email");

  const cleanProductIds = [...new Set(productIds)];
  if (cleanProductIds.length) {
    const { data: validProducts, error: productError } = await db
      .from("products")
      .select("id")
      .in("id", cleanProductIds);
    if (productError) throw productError;
    const validIds = new Set((validProducts ?? []).map((product) => product.id as string));
    const invalid = cleanProductIds.filter((id) => !validIds.has(id));
    if (invalid.length) throw new Error("One or more selected products no longer exist");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db
      .from("collaborator_links")
      .insert({
        name: name.trim(),
        email: resolvedEmail,
        user_id: resolvedUserId,
        code: makeCode(),
        active: true,
      })
      .select("id,code,name,user_id,email,active,created_at")
      .single();

    if (!error) {
      if (cleanProductIds.length) {
        try {
          const { data: existing } = await db
            .from("collaborator_partner_products")
            .select("product_id")
            .eq("user_id", resolvedUserId);
          const existingSet = new Set(
            ((existing ?? []) as { product_id: string }[]).map((r) => String(r.product_id)),
          );
          const toAdd = cleanProductIds.filter((pid) => !existingSet.has(pid));

          if (toAdd.length > 0) {
            const { error: accessError } = await db
              .from("collaborator_partner_products")
              .insert(toAdd.map((product_id) => ({ user_id: resolvedUserId, product_id })));
            if (accessError && accessError.code !== "23505") {
              console.warn("Could not map product access:", accessError.message);
            }
          }
        } catch (err) {
          console.warn("Product access map warning:", err);
        }
      }
      return { ...data, url: `/?ref=${data.code}` };
    }
    if (error.code !== "23505") throw error;
  }

  throw new Error("Could not generate a unique collaborator link. Please try again.");
}

export async function toggleCollaboratorLink(
  accessToken: string | undefined,
  id: string,
  active: boolean,
) {
  await requireAdmin(accessToken);
  const { data, error } = await adminDb(accessToken)
    .from("collaborator_links")
    .update({ active })
    .eq("id", id)
    .select("id,active")
    .single();
  if (error) throw error;
  return data;
}

export async function revokeCollaboratorPartner(accessToken: string | undefined, userId: string) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const { error: linkError } = await db
    .from("collaborator_links")
    .update({ active: false })
    .eq("user_id", userId);
  if (linkError) throw linkError;
  const { error: productError } = await db
    .from("collaborator_partner_products")
    .delete()
    .eq("user_id", userId);
  if (productError) throw productError;
  return { ok: true };
}

export async function getCollaboratorLinkStats(accessToken: string | undefined, id: string) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const { data: link, error } = await db
    .from("collaborator_links")
    .select("id,code,user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new Error("Collaborator link not found");
  return statsForLink(db, link.id, link.code, await getAuthorizedProductIds(db, link.user_id));
}

export async function getCollaboratorDashboard(accessToken?: string) {
  const user = await requireUser(accessToken);
  const db = adminDb(accessToken);
  const userEmail = (user.email ?? "").trim().toLowerCase();

  let linkQuery = db
    .from("collaborator_links")
    .select("id,code,name,email,active,created_at,user_id")
    .order("created_at", { ascending: false });

  if (userEmail) {
    linkQuery = linkQuery.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
  } else {
    linkQuery = linkQuery.eq("user_id", user.id);
  }

  const { data: linkRows, error } = await linkQuery;
  if (error) throw error;

  const links = (linkRows ?? []) as {
    id: string;
    code: string;
    name: string;
    email: string;
    active: boolean;
    created_at: string;
    user_id: string;
  }[];
  const activeLinks = links.filter((link) => link.active);
  if (!activeLinks.length)
    throw new Error("Collaborator access has been revoked or has not been assigned");

  // Auto-heal mismatched user_ids
  try {
    const mismatched = activeLinks.filter((l) => l.user_id !== user.id);
    if (mismatched.length > 0) {
      await db
        .from("collaborator_links")
        .update({ user_id: user.id })
        .in(
          "id",
          mismatched.map((m) => m.id),
        );
      for (const m of mismatched) {
        if (m.user_id) {
          await db
            .from("collaborator_partner_products")
            .update({ user_id: user.id })
            .eq("user_id", m.user_id);
        }
      }
    }
  } catch (healErr) {
    console.warn("Collaborator server dashboard auto-sync notice:", healErr);
  }

  const userIdsToCheck = [...new Set([user.id, ...activeLinks.map((l) => l.user_id)])];
  const { data: accessData } = await db
    .from("collaborator_partner_products")
    .select("product_id")
    .in("user_id", userIdsToCheck);
  const productIds = [
    ...new Set(((accessData ?? []) as { product_id: string }[]).map((r) => r.product_id)),
  ];

  const products = await getProducts(db, productIds);
  const scoped = await Promise.all(activeLinks.map((link) => buildLink(db, link, productIds)));
  const totals = scoped.reduce(
    (sum, link) => ({
      visitors: sum.visitors + link.visitors,
      page_views: sum.page_views + link.page_views,
      signups: sum.signups + link.signups,
      sales: sum.sales + link.sales,
      revenue: sum.revenue + link.revenue,
    }),
    { visitors: 0, page_views: 0, signups: 0, sales: 0, revenue: 0 },
  );

  return {
    userId: user.id,
    email: user.email ?? scoped[0]?.email ?? null,
    links: scoped,
    products,
    productIds,
    totals,
  };
}
