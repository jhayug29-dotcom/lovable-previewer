import { adminClient, requireAdmin, requireUser } from "./supabase.server";

export type PanelAccess = { admin: boolean; seller: boolean; productIds: string[] };

/** Who is allowed into the control panel, and with what scope. */
export async function panelAccess(accessToken: string | undefined): Promise<PanelAccess> {
  const empty: PanelAccess = { admin: false, seller: false, productIds: [] };
  if (!accessToken) return empty;
  let user;
  try {
    user = await requireUser(accessToken);
  } catch {
    return empty;
  }
  const db = adminClient();
  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleRow) return { admin: true, seller: false, productIds: [] };

  const { data: assigned } = await db
    .from("seller_products")
    .select("product_id")
    .eq("user_id", user.id);
  const productIds = (assigned ?? []).map((r) => r.product_id as string);
  return { admin: false, seller: productIds.length > 0, productIds };
}

export type ProductStat = {
  productId: string;
  title: string;
  category: string;
  price: number;
  active: boolean;
  orders: number;
  revenue: number;
};

export type Analytics = {
  scope: "admin" | "seller";
  productCount: number;
  activeProductCount: number;
  totalOrders: number;
  totalRevenue: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersThisWeek: number;
  revenueThisWeek: number;
  visitorsWeek: number;
  visitorsMonth: number;
  viewsWeek: number;
  viewsMonth: number;
  signupsWeek: number;
  signupsMonth: number;
  signInsWeek: number;
  signInsMonth: number;
  products: ProductStat[];
  categories: { category: string; orders: number; revenue: number }[];
  daily: { day: string; orders: number; revenue: number }[];
};

const DAY = 86_400_000;
const isPaid = (status: string) =>
  ["PAID", "SUCCESS", "FREE"].includes((status ?? "").toUpperCase());

/** Full analytics for admins; product-scoped analytics for sellers. */
export async function getAnalytics(accessToken: string | undefined): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");

  const db = adminClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  const { data: productRows } = await db
    .from("products")
    .select("id, title, category, price, active");
  const allProducts = (productRows ?? []) as {
    id: string;
    title: string;
    category: string;
    price: number;
    active: boolean;
  }[];
  const products = access.admin
    ? allProducts
    : allProducts.filter((p) => access.productIds.includes(p.id));
  const allowed = new Set(products.map((p) => p.id));

  let orderQuery = db
    .from("orders")
    .select("product_id, amount, status, created_at")
    .order("created_at", {
      ascending: false,
    });
  if (!access.admin)
    orderQuery = orderQuery.in(
      "product_id",
      products.map((p) => p.id),
    );
  const { data: orderRows } = await orderQuery;
  const orders = (
    (orderRows ?? []) as {
      product_id: string | null;
      amount: number | string;
      status: string;
      created_at: string;
    }[]
  ).filter(
    (o) => isPaid(o.status) && (access.admin || (o.product_id && allowed.has(o.product_id))),
  );

  const stats = new Map<string, ProductStat>(
    products.map((p) => [
      p.id,
      {
        productId: p.id,
        title: p.title,
        category: p.category,
        price: Number(p.price),
        active: p.active,
        orders: 0,
        revenue: 0,
      },
    ]),
  );

  let totalRevenue = 0;
  let ordersThisMonth = 0;
  let revenueThisMonth = 0;
  let ordersThisWeek = 0;
  let revenueThisWeek = 0;
  const dayBuckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    dayBuckets.set(key, { orders: 0, revenue: 0 });
  }

  for (const o of orders) {
    const amount = Number(o.amount) || 0;
    totalRevenue += amount;
    const t = new Date(o.created_at).getTime();
    if (t >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
      const bucket = dayBuckets.get(o.created_at.slice(0, 10));
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += amount;
      }
    }
    if (t >= now - 7 * DAY) {
      ordersThisWeek += 1;
      revenueThisWeek += amount;
    }
    if (o.product_id) {
      const stat = stats.get(o.product_id);
      if (stat) {
        stat.orders += 1;
        stat.revenue += amount;
      }
    }
  }

  const categories = new Map<string, { category: string; orders: number; revenue: number }>();
  for (const stat of stats.values()) {
    const entry = categories.get(stat.category) ?? {
      category: stat.category,
      orders: 0,
      revenue: 0,
    };
    entry.orders += stat.orders;
    entry.revenue += stat.revenue;
    categories.set(stat.category, entry);
  }

  // Visitors + sign-ins are store-wide, so only admins see them.
  let visitorsWeek = 0;
  let visitorsMonth = 0;
  let viewsWeek = 0;
  let viewsMonth = 0;
  let signupsWeek = 0;
  let signupsMonth = 0;
  let signInsWeek = 0;
  let signInsMonth = 0;

  if (access.admin) {
    const { data: viewRows } = await db
      .from("page_views")
      .select("session_id, created_at")
      .gte("created_at", monthAgo)
      .limit(50_000);
    const monthSessions = new Set<string>();
    const weekSessions = new Set<string>();
    for (const v of (viewRows ?? []) as { session_id: string; created_at: string }[]) {
      viewsMonth += 1;
      monthSessions.add(v.session_id || v.created_at);
      if (v.created_at >= weekAgo) {
        viewsWeek += 1;
        weekSessions.add(v.session_id || v.created_at);
      }
    }
    visitorsMonth = monthSessions.size;
    visitorsWeek = weekSessions.size;

    const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of userList?.users ?? []) {
      if (u.created_at >= monthAgo) signupsMonth += 1;
      if (u.created_at >= weekAgo) signupsWeek += 1;
      const last = u.last_sign_in_at;
      if (last && last >= monthAgo) signInsMonth += 1;
      if (last && last >= weekAgo) signInsWeek += 1;
    }
  }

  return {
    scope: access.admin ? "admin" : "seller",
    productCount: products.length,
    activeProductCount: products.filter((p) => p.active).length,
    totalOrders: orders.length,
    totalRevenue,
    ordersThisMonth,
    revenueThisMonth,
    ordersThisWeek,
    revenueThisWeek,
    visitorsWeek,
    visitorsMonth,
    viewsWeek,
    viewsMonth,
    signupsWeek,
    signupsMonth,
    signInsWeek,
    signInsMonth,
    products: [...stats.values()].sort((a, b) => b.revenue - a.revenue),
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    daily: [...dayBuckets.entries()].map(([day, v]) => ({ day, ...v })),
  };
}

export type SellerRow = {
  userId: string;
  email: string;
  fullName: string | null;
  productIds: string[];
};

/** Every account that has at least one assigned product. Admin-only. */
export async function listSellers(accessToken: string | undefined): Promise<SellerRow[]> {
  await requireAdmin(accessToken);
  const db = adminClient();
  const { data: rows, error } = await db.from("seller_products").select("user_id, product_id");
  if (error) throw error;

  const byUser = new Map<string, string[]>();
  for (const r of (rows ?? []) as { user_id: string; product_id: string }[]) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.product_id]);
  }
  if (byUser.size === 0) return [];

  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return [...byUser.entries()].map(([userId, productIds]) => {
    const u = userList?.users.find((x) => x.id === userId);
    return {
      userId,
      email: u?.email ?? "(unknown account)",
      fullName: (u?.user_metadata?.["full_name"] as string | undefined) ?? null,
      productIds,
    };
  });
}

/** Replace a user's assigned products. An empty list removes seller access. Admin-only. */
export async function setSellerProducts(
  accessToken: string | undefined,
  userId: string,
  productIds: string[],
): Promise<{ ok: true }> {
  await requireAdmin(accessToken);
  const db = adminClient();
  const { error: delError } = await db.from("seller_products").delete().eq("user_id", userId);
  if (delError) throw delError;
  if (productIds.length > 0) {
    const { error } = await db
      .from("seller_products")
      .insert(productIds.map((product_id) => ({ user_id: userId, product_id })));
    if (error) throw error;
  }
  return { ok: true };
}
