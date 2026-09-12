import { adminClient, getDbClient, getServiceRoleKey, requireAdmin, requireUser } from "./supabase.server";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);

type DbClient = ReturnType<typeof getDbClient>;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
type LinkRow = { id: string; code: string; name: string; user_id: string; email: string; active: boolean; created_at: string };

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const makeCode = () => `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

function adminDb(accessToken?: string): DbClient {
  if (accessToken) return getDbClient(accessToken);
  return adminClient();
}

async function getProducts(db: DbClient, ids?: string[]): Promise<Product[]> {
  let query = db
    .from("products")
    .select("id,title,category,price,active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (ids) query = query.in("id", ids.length ? ids : [EMPTY_UUID]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function getProductIds(db: DbClient, userId: string): Promise<string[]> {
  const { data, error } = await db.from("collaborator_partner_products").select("product_id").eq("user_id", userId);
  if (error) throw error;
  return [...new Set(((data ?? []) as { product_id: string }[]).map((row) => row.product_id))];
}

async function safeStats(db: DbClient, link: LinkRow, allowedProductIds: string[]) {
  try {
    const [{ data: views, error: viewError }, { data: orders, error: orderError }] = await Promise.all([
      db
        .from("page_views")
        .select("session_id,product_id")
        .or(`collaborator_code.eq.${link.code},collaborator_link_id.eq.${link.id}`)
        .limit(100000),
      db.from("orders").select("id,product_id,amount,status").eq("collaborator_link_id", link.id).limit(100000),
    ]);

    if (viewError || orderError) throw viewError ?? orderError;

    const allowed = new Set(allowedProductIds);
    const relevantViews = ((views ?? []) as { session_id: string | null; product_id: string | null }[]).filter(
      (view) => !view.product_id || !allowedProductIds.length || allowed.has(view.product_id),
    );
    const visibleOrders = ((orders ?? []) as { id: string; product_id: string | null; amount: number | string | null; status: string }[]).filter(
      (order) =>
        PAID_STATUSES.has((order.status ?? "").toUpperCase()) &&
        (!allowedProductIds.length || (order.product_id ? allowed.has(order.product_id) : true)),
    );
    const visitors = new Set(
      relevantViews
        .map((view) => view.session_id)
        .filter(Boolean),
    );

    return {
      visitors: visitors.size,
      page_views: relevantViews.length,
      sales: visibleOrders.length,
      revenue: visibleOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0),
    };
  } catch {
    return { visitors: 0, page_views: 0, sales: 0, revenue: 0 };
  }
}

async function resolveUser(db: DbClient, email?: string, userId?: string) {
  let resolvedUserId = userId?.trim() || "";
  let resolvedEmail = email?.trim().toLowerCase() || "";

  if (resolvedUserId) {
    const { data: profile } = await db.from("profiles").select("id,email").eq("id", resolvedUserId).maybeSingle();
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      try {
        const { data, error: authError } = await adminClient().auth.admin.getUserById(resolvedUserId);
        if (!authError && data?.user) {
          resolvedEmail = String(data.user.email ?? resolvedEmail).toLowerCase();
        }
      } catch {}
    }
  }

  if (!resolvedUserId && resolvedEmail) {
    const { data: profile } = await db.from("profiles").select("id,email").ilike("email", resolvedEmail).maybeSingle();
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      try {
        const { data, error: authError } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (!authError && data?.users) {
          const match = data.users.find((user) => String(user.email ?? "").toLowerCase() === resolvedEmail);
          if (match) {
            resolvedUserId = match.id;
            resolvedEmail = String(match.email ?? resolvedEmail).toLowerCase();
          }
        }
      } catch {}
    }
  }

  // Direct client fallback
  if (!resolvedUserId && userId) resolvedUserId = userId.trim();
  if (!resolvedEmail && email) resolvedEmail = email.trim().toLowerCase();

  if (!resolvedUserId) throw new Error("No registered user was found for that email");
  if (!resolvedEmail) throw new Error("The selected account has no email address");
  return { userId: resolvedUserId, email: resolvedEmail };
}

export async function listCollaboratorProductsAdmin(accessToken?: string) {
  await requireAdmin(accessToken);
  return getProducts(adminDb(accessToken));
}

export async function createCollaboratorLinkAdmin(
  accessToken: string | undefined,
  name: string,
  email?: string,
  userId?: string,
  productIds: string[] = [],
) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const recipient = await resolveUser(db, email, userId);
  const cleanProductIds = [...new Set(productIds.filter(Boolean))];
  if (!cleanProductIds.length) throw new Error("Select at least one product");

  const { data: validProducts, error: productError } = await db.from("products").select("id").in("id", cleanProductIds);
  if (productError) throw productError;
  const validIds = new Set((validProducts ?? []).map((row) => String(row.id)));
  const invalidIds = cleanProductIds.filter((id) => !validIds.has(id));
  if (invalidIds.length) throw new Error("One or more selected products no longer exist");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: link, error: linkError } = await db
      .from("collaborator_links")
      .insert({ name: name.trim(), email: recipient.email, user_id: recipient.userId, code: makeCode(), active: true })
      .select("id,code,name,user_id,email,active,created_at")
      .single();

    if (!linkError && link) {
      if (cleanProductIds.length > 0) {
        try {
          const { data: existing } = await db
            .from("collaborator_partner_products")
            .select("product_id")
            .eq("user_id", recipient.userId);
          const existingSet = new Set(((existing ?? []) as { product_id: string }[]).map((r) => String(r.product_id)));
          const toAdd = cleanProductIds.filter((pid) => !existingSet.has(pid));

          if (toAdd.length > 0) {
            const { error: accessError } = await db
              .from("collaborator_partner_products")
              .insert(toAdd.map((product_id) => ({ user_id: recipient.userId, product_id })));
            if (accessError && accessError.code !== "23505") {
              console.warn("Non-fatal collaborator product access map warning:", accessError.message);
            }
          }
        } catch (err) {
          console.warn("Product access map warning:", err);
        }
      }
      return { ...link, url: `/?ref=${link.code}` };
    }

    if (linkError?.code === "23505" && String(linkError.message).toLowerCase().includes("code")) continue;
    if (linkError?.code === "23505") throw new Error("A collaborator link with that data already exists. Choose another name.");
    if (linkError) throw new Error(`Could not create collaborator: ${linkError.message}`);
  }

  throw new Error("Could not generate a unique referral code. Please try again.");
}

export async function setCollaboratorProductAccessAdmin(accessToken: string | undefined, userId: string, productIds: string[]) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const clean = [...new Set(productIds.filter(Boolean))];

  const { error: deleteError } = await db.from("collaborator_partner_products").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (clean.length) {
    const { data: validProducts, error: productError } = await db.from("products").select("id").in("id", clean);
    if (productError) throw productError;
    const valid = new Set((validProducts ?? []).map((row) => String(row.id)));
    const invalid = clean.filter((id) => !valid.has(id));
    if (invalid.length) throw new Error("One or more selected products no longer exist");
    const { error: insertError } = await db
      .from("collaborator_partner_products")
      .insert(clean.map((product_id) => ({ user_id: userId, product_id })));
    if (insertError && insertError.code !== "23505") throw insertError;
  }
  return { ok: true, productIds: clean };
}

export async function listCollaboratorPartnersAdmin(accessToken?: string) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const { data: linkRows, error: linkError } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });
  if (linkError) throw linkError;

  const rows = (linkRows ?? []) as LinkRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id,email,full_name").in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));

  const { data: accessRows } = userIds.length
    ? await db.from("collaborator_partner_products").select("user_id,product_id").in("user_id", userIds)
    : { data: [] as { user_id: string; product_id: string }[] };
  const productIdsByUser = new Map<string, string[]>();
  for (const row of (accessRows ?? []) as { user_id: string; product_id: string }[]) {
    productIdsByUser.set(row.user_id, [...new Set([...(productIdsByUser.get(row.user_id) ?? []), row.product_id])]);
  }

  const result = [] as Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    active: boolean;
    product_ids: string[];
    products: Product[];
    totals: { visitors: number; page_views: number; sales: number; revenue: number };
    links: Array<LinkRow & { url: string; visitors: number; page_views: number; sales: number; revenue: number }>;
  }>;

  for (const userId of userIds) {
    const productIds = productIdsByUser.get(userId) ?? [];
    const userRows = rows.filter((row) => row.user_id === userId);
    const links = await Promise.all(userRows.map(async (row) => ({ ...row, url: `/?ref=${row.code}`, ...(await safeStats(db, row, productIds)) })));
    const totals = links.reduce(
      (sum, link) => ({ visitors: sum.visitors + link.visitors, page_views: sum.page_views + link.page_views, sales: sum.sales + link.sales, revenue: sum.revenue + link.revenue }),
      { visitors: 0, page_views: 0, sales: 0, revenue: 0 },
    );
    const profile = profileMap.get(userId);
    result.push({
      user_id: userId,
      email: String(profile?.email ?? userRows[0]?.email ?? ""),
      full_name: profile?.full_name ?? null,
      active: links.some((link) => link.active),
      product_ids: productIds,
      products: await getProducts(db, productIds),
      totals,
      links,
    });
  }

  return result;
}

export async function getCollaboratorDashboardAdmin(accessToken?: string) {
  const user = await requireUser(accessToken);
  const db = adminDb(accessToken);

  const { data: linkRows, error: linkError } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (linkError) throw linkError;

  const activeLinks = ((linkRows ?? []) as LinkRow[]).filter((link) => link.active);
  if (!activeLinks.length) throw new Error("Collaborator access has been revoked or has not been assigned");

  const productIds = await getProductIds(db, user.id);
  const products = await getProducts(db, productIds);
  const links = await Promise.all(activeLinks.map(async (link) => ({ ...link, url: `/?ref=${link.code}`, ...(await safeStats(db, link, productIds)) })));
  const totals = links.reduce(
    (sum, link) => ({ visitors: sum.visitors + link.visitors, page_views: sum.page_views + link.page_views, sales: sum.sales + link.sales, revenue: sum.revenue + link.revenue }),
    { visitors: 0, page_views: 0, sales: 0, revenue: 0 },
  );

  return { userId: user.id, email: user.email ?? links[0]?.email ?? null, links, products, productIds, totals };
}
