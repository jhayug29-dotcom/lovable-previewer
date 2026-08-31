import {
  adminClient,
  userClient,
  getDbClient,
  requireAdmin,
  requireUser,
  isMasterAdminEmail,
} from "./supabase.server";
import { loadProducts } from "./catalog.server";

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

  // Master admin fast-path + sync role in database
  if (isMasterAdminEmail(user.email)) {
    try {
      const db = getDbClient(accessToken);
      await db.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      await db
        .from("user_roles")
        .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    } catch {
      // Ignore background sync errors
    }
    return { admin: true, seller: false, productIds: [] };
  }

  try {
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
  } catch (err) {
    console.warn("panelAccess error:", err);
    return { admin: isMasterAdminEmail(user.email), seller: false, productIds: [] };
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
const isPaid = (status: string | null | undefined) =>
  ["PAID", "SUCCESS", "FREE", "COMPLETED"].includes((status ?? "").trim().toUpperCase());

/** Full analytics for admins; product-scoped analytics for sellers. */
export async function getAnalytics(accessToken: string | undefined): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");

  const db = getDbClient(accessToken);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  // Load all products (from DB or fallback catalog)
  let allProducts: {
    id: string;
    slug?: string;
    title: string;
    category: string;
    price: number;
    active: boolean;
    sales?: number;
  }[] = [];

  try {
    const { data: productRows } = await db
      .from("products")
      .select("id, slug, title, category, price, active, sales");
    if (productRows && productRows.length > 0) {
      allProducts = productRows.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: p.category || "General",
        price: Number(p.price) || 0,
        active: Boolean(p.active),
        sales: Number(p.sales) || 0,
      }));
    }
  } catch (err) {
    console.warn("products query failed, falling back to catalog:", err);
  }

  if (allProducts.length === 0) {
    const staticCatalog = await loadProducts();
    allProducts = staticCatalog.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      category: p.category || "General",
      price: Number(p.price) || 0,
      active: Boolean(p.active),
      sales: Number(p.sales) || 0,
    }));
  }

  const products = access.admin
    ? allProducts
    : allProducts.filter((p) => access.productIds.includes(p.id));
  const allowedIds = new Set(products.map((p) => p.id));
  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const productBySlug = new Map(allProducts.map((p) => [p.slug?.toLowerCase() ?? "", p]));
  const productByTitle = new Map(allProducts.map((p) => [p.title.trim().toLowerCase(), p]));

  // Retrieve orders
  type OrderRow = {
    id?: string;
    product_id?: string | null;
    amount?: number | string | null;
    status?: string | null;
    created_at?: string | null;
    paid_at?: string | null;
    customer_email?: string | null;
    customer_name?: string | null;
    cf_order_id?: string | null;
  };

  let rawOrders: OrderRow[] = [];
  try {
    let orderQuery = db
      .from("orders")
      .select(
        "id, product_id, amount, status, created_at, paid_at, customer_email, customer_name, cf_order_id",
      )
      .order("created_at", { ascending: false });

    if (!access.admin) {
      orderQuery = orderQuery.in(
        "product_id",
        products.map((p) => p.id),
      );
    }
    const { data: orderRows, error: orderErr } = await orderQuery;
    if (!orderErr && orderRows) {
      rawOrders = orderRows as OrderRow[];
    }
  } catch (err) {
    console.warn("orders query warning in getAnalytics:", err);
  }

  // Filter only paid / completed orders
  const paidOrders = rawOrders.filter((o) => {
    if (!isPaid(o.status)) return false;
    if (access.admin) return true;
    return o.product_id && allowedIds.has(o.product_id);
  });

  const stats = new Map<string, ProductStat>(
    products.map((p) => [
      p.id,
      {
        productId: p.id,
        title: p.title,
        category: p.category,
        price: Number(p.price) || 0,
        active: p.active,
        orders: 0,
        revenue: 0,
      },
    ]),
  );

  let totalRevenue = 0;
  let totalOrders = 0;
  let ordersThisMonth = 0;
  let revenueThisMonth = 0;
  let ordersThisWeek = 0;
  let revenueThisWeek = 0;

  const dayBuckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    dayBuckets.set(key, { orders: 0, revenue: 0 });
  }

  for (const o of paidOrders) {
    const amount = Math.max(0, Number(o.amount) || 0);
    const dateStr = o.paid_at || o.created_at || new Date().toISOString();
    const orderTimestamp = new Date(dateStr).getTime();
    const dayKey = dateStr.slice(0, 10);

    totalOrders += 1;
    totalRevenue += amount;

    if (orderTimestamp >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
      const bucket = dayBuckets.get(dayKey);
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += amount;
      }
    }
    if (orderTimestamp >= now - 7 * DAY) {
      ordersThisWeek += 1;
      revenueThisWeek += amount;
    }

    // Match order to product stat
    let matchedProd = o.product_id ? productById.get(o.product_id) : undefined;
    if (!matchedProd && o.product_id) {
      matchedProd = productBySlug.get(o.product_id.toLowerCase());
    }

    if (matchedProd && stats.has(matchedProd.id)) {
      const stat = stats.get(matchedProd.id)!;
      stat.orders += 1;
      stat.revenue += amount;
    }
  }

  // Preserve historical sales recorded directly on the products table
  for (const p of products) {
    const stat = stats.get(p.id);
    if (stat && (p.sales ?? 0) > stat.orders) {
      const diff = (p.sales ?? 0) - stat.orders;
      stat.orders = p.sales ?? 0;
      stat.revenue += diff * stat.price;
      totalOrders += diff;
      totalRevenue += diff * stat.price;
    }
  }

  const categoriesMap = new Map<string, { category: string; orders: number; revenue: number }>();
  for (const stat of stats.values()) {
    const entry = categoriesMap.get(stat.category) ?? {
      category: stat.category,
      orders: 0,
      revenue: 0,
    };
    entry.orders += stat.orders;
    entry.revenue += stat.revenue;
    categoriesMap.set(stat.category, entry);
  }

  // Visitors & Page Views
  let visitorsWeek = 0;
  let visitorsMonth = 0;
  let viewsWeek = 0;
  let viewsMonth = 0;

  // Signups & Sign-ins
  let signupsWeek = 0;
  let signupsMonth = 0;
  let signInsWeek = 0;
  let signInsMonth = 0;

  if (access.admin) {
    // 1. Try querying page_views table safely
    try {
      const { data: viewRows, error: viewErr } = await db
        .from("page_views")
        .select("session_id, created_at")
        .gte("created_at", monthAgo)
        .limit(50_000);
      if (!viewErr && viewRows) {
        const monthSessions = new Set<string>();
        const weekSessions = new Set<string>();
        for (const v of viewRows as { session_id?: string; created_at?: string }[]) {
          const createdAt = v.created_at ?? "";
          viewsMonth += 1;
          if (v.session_id) monthSessions.add(v.session_id);
          if (createdAt >= weekAgo) {
            viewsWeek += 1;
            if (v.session_id) weekSessions.add(v.session_id);
          }
        }
        visitorsMonth = monthSessions.size;
        visitorsWeek = weekSessions.size;
      }
    } catch {
      // Graceful fallback if page_views table does not exist
    }

    // 2. Count users and sign-ins from Auth and Profiles
    let authUsersCounted = false;
    try {
      const { data: userList, error: authErr } = await db.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (!authErr && userList?.users && userList.users.length > 0) {
        authUsersCounted = true;
        for (const u of userList.users) {
          const createdAt = u.created_at || "";
          if (createdAt >= monthAgo) signupsMonth += 1;
          if (createdAt >= weekAgo) signupsWeek += 1;
          const last = u.last_sign_in_at || createdAt;
          if (last && last >= monthAgo) signInsMonth += 1;
          if (last && last >= weekAgo) signInsWeek += 1;
        }
      }
    } catch {
      // auth.admin unavailable (e.g. userClient)
    }

    if (!authUsersCounted) {
      try {
        const { data: profileList } = await db
          .from("profiles")
          .select("created_at, last_sign_in_at, updated_at");
        for (const p of (profileList ?? []) as {
          created_at?: string;
          last_sign_in_at?: string;
          updated_at?: string;
        }[]) {
          const createdAt = p.created_at || "";
          if (createdAt >= monthAgo) signupsMonth += 1;
          if (createdAt >= weekAgo) signupsWeek += 1;
          const last = p.last_sign_in_at || p.updated_at || createdAt;
          if (last && last >= monthAgo) signInsMonth += 1;
          if (last && last >= weekAgo) signInsWeek += 1;
        }
      } catch {
        // Ignore fallback
      }
    }

    // Ensure active purchasing customers are reflected in sign-ins if higher
    const uniqueCustomerEmailsWeek = new Set<string>();
    const uniqueCustomerEmailsMonth = new Set<string>();
    for (const o of paidOrders) {
      if (o.customer_email) {
        const t = o.paid_at || o.created_at || "";
        if (t >= monthAgo) uniqueCustomerEmailsMonth.add(o.customer_email.toLowerCase());
        if (t >= weekAgo) uniqueCustomerEmailsWeek.add(o.customer_email.toLowerCase());
      }
    }
    signInsMonth = Math.max(signInsMonth, uniqueCustomerEmailsMonth.size);
    signInsWeek = Math.max(signInsWeek, uniqueCustomerEmailsWeek.size);
  }

  return {
    scope: access.admin ? "admin" : "seller",
    productCount: products.length,
    activeProductCount: products.filter((p) => p.active).length,
    totalOrders,
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
    categories: [...categoriesMap.values()].sort((a, b) => b.revenue - a.revenue),
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

  try {
    const { data: rows, error } = await db.from("seller_products").select("user_id, product_id");
    if (error) return [];

    const byUser = new Map<string, string[]>();
    for (const r of (rows ?? []) as { user_id: string; product_id: string }[]) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.product_id]);
    }
    if (byUser.size === 0) return [];

    let userList: { id: string; email?: string; user_metadata?: Record<string, unknown> }[] = [];
    try {
      const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userList = authData?.users ?? [];
    } catch {
      const { data: profileRows } = await db.from("profiles").select("id, email, full_name");
      userList = (profileRows ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        user_metadata: { full_name: p.full_name },
      }));
    }

    return [...byUser.entries()].map(([userId, productIds]) => {
      const u = userList.find((x) => x.id === userId);
      return {
        userId,
        email: u?.email ?? "(unknown account)",
        fullName: (u?.user_metadata?.["full_name"] as string | undefined) ?? null,
        productIds,
      };
    });
  } catch {
    return [];
  }
}

/** Replace a user's assigned products. An empty list removes seller access. Admin-only. */
export async function setSellerProducts(
  accessToken: string | undefined,
  userId: string,
  productIds: string[],
): Promise<{ ok: true }> {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);

  try {
    const { error: delError } = await db.from("seller_products").delete().eq("user_id", userId);
    if (delError) console.warn("seller_products delete warning:", delError);
    if (productIds.length > 0) {
      const { error } = await db
        .from("seller_products")
        .insert(productIds.map((product_id) => ({ user_id: userId, product_id })));
      if (error) throw error;
    }
  } catch (err) {
    console.error("setSellerProducts error:", err);
    throw err;
  }
  return { ok: true };
}
