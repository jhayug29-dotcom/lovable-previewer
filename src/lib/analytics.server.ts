import {
  getDbClient,
  requireAdmin,
  requireUser,
  adminClient,
  getServiceRoleKey,
} from "./supabase.server";

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

  // Owner account is unconditionally an admin
  if (user.email && user.email.toLowerCase() === "growchannel2026@gmail.com") {
    return { admin: true, seller: false, productIds: [] };
  }

  const db = getDbClient(accessToken);
  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleRow) return { admin: true, seller: false, productIds: [] };

  try {
    const { data: assigned } = await db
      .from("seller_products")
      .select("product_id")
      .eq("user_id", user.id);
    const productIds = (assigned ?? []).map((r) => r.product_id as string);
    return { admin: false, seller: productIds.length > 0, productIds };
  } catch {
    return { admin: false, seller: false, productIds: [] };
  }
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
  ["PAID", "SUCCESS", "FREE", "COMPLETED", "CAPTURED"].includes((status ?? "").toUpperCase());

/** Full analytics for admins; product-scoped analytics for sellers. */
export async function getAnalytics(accessToken: string | undefined): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");

  const db = getDbClient(accessToken);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  // 1. Fetch catalog products
  const { data: productRows } = await db
    .from("products")
    .select("id, title, category, price, active, sales");
  const allProducts = (productRows ?? []) as {
    id: string;
    title: string;
    category: string;
    price: number;
    active: boolean;
    sales?: number | null;
  }[];
  const products = access.admin
    ? allProducts
    : allProducts.filter((p) => access.productIds.includes(p.id));
  const allowed = new Set(products.map((p) => p.id));

  // 2. Fetch orders
  let orderQuery = db
    .from("orders")
    .select("product_id, amount, status, created_at, paid_at")
    .order("created_at", { ascending: false });
  if (!access.admin) {
    orderQuery = orderQuery.in(
      "product_id",
      products.map((p) => p.id),
    );
  }

  let orderRows:
    | {
        product_id: string | null;
        amount: number | string;
        status: string;
        created_at: string;
        paid_at?: string | null;
      }[]
    | null = null;

  try {
    const res = await orderQuery;
    orderRows = res.data;
  } catch {
    orderRows = [];
  }

  const orders = (orderRows ?? []).filter(
    (o) => isPaid(o.status) && (access.admin || (o.product_id && allowed.has(o.product_id))),
  );

  // Initialize product stats map with base sales
  const stats = new Map<string, ProductStat>(
    products.map((p) => [
      p.id,
      {
        productId: p.id,
        title: p.title,
        category: p.category,
        price: Number(p.price) || 0,
        active: p.active,
        orders: Number(p.sales) || 0,
        revenue: (Number(p.sales) || 0) * (Number(p.price) || 0),
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

  // Count order records
  const orderCountByProduct = new Map<string, number>();
  const orderRevenueByProduct = new Map<string, number>();

  for (const o of orders) {
    const amount = Number(o.amount) || 0;
    totalRevenue += amount;
    const dateStr = o.paid_at || o.created_at;
    const t = new Date(dateStr).getTime();

    if (t >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
      const bucket = dayBuckets.get(dateStr.slice(0, 10));
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
      orderCountByProduct.set(o.product_id, (orderCountByProduct.get(o.product_id) ?? 0) + 1);
      orderRevenueByProduct.set(
        o.product_id,
        (orderRevenueByProduct.get(o.product_id) ?? 0) + amount,
      );
    }
  }

  // Merge table orders into product stats (using whichever is higher between order rows and product base sales counter)
  for (const [prodId, stat] of stats.entries()) {
    const recordedOrders = orderCountByProduct.get(prodId) ?? 0;
    const recordedRevenue = orderRevenueByProduct.get(prodId) ?? 0;
    if (recordedOrders > 0) {
      stat.orders = Math.max(stat.orders, recordedOrders);
      stat.revenue = Math.max(stat.revenue, recordedRevenue);
    }
  }

  // Aggregate total orders and revenue including product base sales
  let aggregatedTotalOrders = orders.length;
  let aggregatedTotalRevenue = totalRevenue;

  let baseSalesOrders = 0;
  let baseSalesRevenue = 0;
  for (const p of products) {
    const baseSales = Number(p.sales) || 0;
    const recorded = orderCountByProduct.get(p.id) ?? 0;
    if (baseSales > recorded) {
      const diff = baseSales - recorded;
      baseSalesOrders += diff;
      baseSalesRevenue += diff * (Number(p.price) || 0);
    }
  }
  aggregatedTotalOrders += baseSalesOrders;
  aggregatedTotalRevenue += baseSalesRevenue;

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
    try {
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
    } catch {
      // page_views table optional
    }

    // 1. Fetch user accounts from profiles table
    try {
      const { data: profiles } = await db.from("profiles").select("id, created_at, email");
      for (const p of profiles ?? []) {
        if (p.created_at) {
          if (p.created_at >= monthAgo) signupsMonth += 1;
          if (p.created_at >= weekAgo) signupsWeek += 1;
        }
      }
    } catch {
      // profiles query fallback
    }

    // 2. Fetch users from auth.admin if service role key is available
    if (getServiceRoleKey()) {
      try {
        const { data: userList } = await adminClient().auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        let adminSignupsMonth = 0;
        let adminSignupsWeek = 0;
        for (const u of userList?.users ?? []) {
          if (u.created_at >= monthAgo) adminSignupsMonth += 1;
          if (u.created_at >= weekAgo) adminSignupsWeek += 1;
          const last = u.last_sign_in_at;
          if (last && last >= monthAgo) signInsMonth += 1;
          if (last && last >= weekAgo) signInsWeek += 1;
        }
        if (adminSignupsMonth > signupsMonth) signupsMonth = adminSignupsMonth;
        if (adminSignupsWeek > signupsWeek) signupsWeek = adminSignupsWeek;
      } catch {
        // auth.admin optional
      }
    }

    // Baseline active users from recent orders if signIns is 0
    if (signInsMonth === 0 && ordersThisMonth > 0) {
      signInsMonth = ordersThisMonth;
    }
    if (signInsWeek === 0 && ordersThisWeek > 0) {
      signInsWeek = ordersThisWeek;
    }
  }

  return {
    scope: access.admin ? "admin" : "seller",
    productCount: products.length,
    activeProductCount: products.filter((p) => p.active).length,
    totalOrders: aggregatedTotalOrders,
    totalRevenue: aggregatedTotalRevenue,
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
  const db = getDbClient(accessToken);
  const { data: rows, error } = await db.from("seller_products").select("user_id, product_id");
  if (error) return [];

  const byUser = new Map<string, string[]>();
  for (const r of (rows ?? []) as { user_id: string; product_id: string }[]) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.product_id]);
  }
  if (byUser.size === 0) return [];

  const { data: profiles } = await db.from("profiles").select("id, email, full_name");
  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return [...byUser.entries()].map(([userId, productIds]) => {
    const prof = profileMap.get(userId);
    return {
      userId,
      email: prof?.email ?? "(unknown account)",
      fullName: (prof?.full_name as string | undefined) ?? null,
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
  const db = getDbClient(accessToken);
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
