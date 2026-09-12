import { adminClient, getDbClient, getServiceRoleKey, requireAdmin } from "./supabase.server";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);

type DbClient = ReturnType<typeof getDbClient>;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
type LinkRow = { id: string; code: string; name: string; user_id: string; email: string; active: boolean; created_at: string };

const makeCode = () =>
  `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

function adminDb(accessToken?: string): DbClient {
  return getServiceRoleKey() ? adminClient() : getDbClient(accessToken);
}

async function getProducts(db: DbClient, ids?: string[]): Promise<Product[]> {
  let query = db.from("products").select("id,title,category,price,active").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function getProductIds(db: DbClient, userId: string): Promise<string[]> {
  const { data, error } = await db.from("collaborator_partner_products").select("product_id").eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { product_id: string }[]).map((row) => row.product_id);
}

async function safeStats(db: DbClient, link: LinkRow, allowedProductIds: string[]) {
  try {
    const [{ data: views, error: viewError }, { data: orders, error: orderError }] = await Promise.all([
      db.from("page_views").select("session_id").eq("collaborator_code", link.code).limit(100000),
      db.from("orders").select("id,product_id,amount,status").eq("collaborator_link_id", link.id).limit(100000),
    ]);

    if (viewError || orderError) throw viewError ?? orderError;

    const allowed = new Set(allowedProductIds);
    const visibleOrders = ((orders ?? []) as { id: string; product_id: string | null; amount: number | string | null; status: string }[]).filter(
      (order) => PAID_STATUSES.has((order.status ?? "").toUpperCase()) && Boolean(order.product_id && allowed.has(order.product_id)),
    );
    const visitors = new Set(
      ((views ?? []) as { session_id: string | null }[]).map((view) => view.session_id).filter(Boolean),
    );

    return {
      visitors: visitors.size,
      page_views: (views ?? []).length,
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
    const { data: profile, error } = await db.from("profiles").select("id,email").eq("id", resolvedUserId).maybeSingle();
    if (error) throw error;
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      const { data, error: authError } = await adminClient().auth.admin.getUserById(resolvedUserId);
      if (authError || !data.user) throw new Error("The selected account no longer exists");
      resolvedEmail = String(data.user.email ?? resolvedEmail).toLowerCase();
    }
  } else {
    if (!resolvedEmail) throw new Error("A registered user or email is required");
    const { data: profile, error } = await db.from("profiles").select("id,email").ilike("email", resolvedEmail).maybeSingle();
    if (error) throw error;
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      const { data, error: authError } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authError) throw authError;
      const match = data.users.find((user) => String(user.email ?? "").toLowerCase() === resolvedEmail);
      if (match) resolvedUserId = match.id;
    }
  }

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
      const { error: accessError } = await db
        .from("collaborator_partner_products")
        .upsert(
          cleanProductIds.map((product_id) => ({ user_id: recipient.userId, product_id })),
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      if (accessError) {
        await db.from("collaborator_links").delete().eq("id", link.id);
        throw new Error(`Could not save product access: ${accessError.message}`);
      }
      return { ...link, url: `/?ref=${link.code}` };
    }

    if (linkError?.code === "23505" && String(linkError.message).toLowerCase().includes("code")) continue;
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
      .upsert(clean.map((product_id) => ({ user_id: userId, product_id })), { onConflict: "user_id,product_id", ignoreDuplicates: true });
    if (insertError) throw insertError;
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
  const [{ data: profiles }, productAccessResult] = await Promise.all([
    userIds.length ? db.from("profiles").select("id,email,full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
    userIds.length ? db.from("collaborator_partner_products").select("user_id,product_id").in("user_id", userIds) : Promise.resolve({ data: [] as { user_id: string; product_id: string }[] }),
  ]);

  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const productIdsByUser = new Map<string, string[]>();
  for (const row of (productAccessResult.data ?? []) as { user_id: string; product_id: string }[]) {
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
