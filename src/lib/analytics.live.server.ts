import { adminClient, getDbClient } from "./supabase.server";
import { panelAccess, type Analytics, type ProductStat } from "./analytics.server";

const DAY = 86_400_000;
const PAID = new Set(["PAID", "SUCCESS", "FREE", "COMPLETED", "CAPTURED"]);

function isPaid(status: unknown) {
  return PAID.has(String(status ?? "").toUpperCase());
}

async function readBoth<T>(
  accessToken: string | undefined,
  query: (db: ReturnType<typeof adminClient>) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; source: "privileged" | "user" | "none"; privilegedError?: string; userError?: string }> {
  let privilegedRows: T[] = [];
  let userRows: T[] = [];
  let privilegedError: string | undefined;
  let userError: string | undefined;

  try {
    const result = await query(adminClient());
    if (result.error) privilegedError = result.error.message;
    privilegedRows = result.data ?? [];
  } catch (error) {
    privilegedError = error instanceof Error ? error.message : String(error);
  }

  if (accessToken) {
    try {
      const result = await query(getDbClient(accessToken));
      if (result.error) userError = result.error.message;
      userRows = result.data ?? [];
    } catch (error) {
      userError = error instanceof Error ? error.message : String(error);
    }
  }

  if (privilegedRows.length >= userRows.length && privilegedRows.length > 0) {
    return { rows: privilegedRows, source: "privileged", privilegedError, userError };
  }
  if (userRows.length > 0) {
    return { rows: userRows, source: "user", privilegedError, userError };
  }
  return { rows: [], source: "none", privilegedError, userError };
}

export async function getLiveAnalytics(accessToken: string | undefined): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  const productRead = await readBoth(accessToken, (db) =>
    db.from("products").select("id, title, category, price, active, sales"),
  );
  const orderRead = await readBoth(accessToken, (db) =>
    db.from("orders").select("id, product_id, amount, status, created_at, paid_at"),
  );

  const products = productRead.rows as {
    id: string;
    title: string;
    category: string;
    price: number;
    active: boolean;
    sales?: number | null;
  }[];
  const allowed = new Set(products.map((p) => p.id));

  const orders = orderRead.rows.filter(
    (row: any) => isPaid(row.status) && (access.admin || (row.product_id && allowed.has(row.product_id))),
  ) as {
    id: string;
    product_id: string | null;
    amount: number | string | null;
    status: string;
    created_at: string;
    paid_at: string | null;
  }[];

  const stats = new Map<string, ProductStat>();
  for (const product of products) {
    stats.set(product.id, {
      productId: product.id,
      title: product.title,
      category: product.category,
      price: Number(product.price) || 0,
      active: Boolean(product.active),
      orders: Math.max(0, Number(product.sales) || 0),
      revenue: 0,
    });
  }

  let totalRevenue = 0;
  let ordersThisMonth = 0;
  let revenueThisMonth = 0;
  let ordersThisWeek = 0;
  let revenueThisWeek = 0;
  const categories = new Map<string, { category: string; orders: number; revenue: number }>();
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    dailyMap.set(new Date(now - i * DAY).toISOString().slice(0, 10), { orders: 0, revenue: 0 });
  }

  const paidCounts = new Map<string, number>();
  for (const order of orders) {
    const amount = Number(order.amount) || 0;
    const when = order.paid_at || order.created_at;
    const timestamp = new Date(when).getTime();
    const day = when.slice(0, 10);
    totalRevenue += amount;

    if (timestamp >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
    }
    if (timestamp >= now - 7 * DAY) {
      ordersThisWeek += 1;
      revenueThisWeek += amount;
    }

    const bucket = dailyMap.get(day);
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue += amount;
    }

    if (order.product_id) {
      paidCounts.set(order.product_id, (paidCounts.get(order.product_id) ?? 0) + 1);
      const stat = stats.get(order.product_id);
      if (stat) stat.revenue += amount;
      if (stat) {
        const category = categories.get(stat.category) ?? { category: stat.category, orders: 0, revenue: 0 };
        category.orders += 1;
        category.revenue += amount;
        categories.set(stat.category, category);
      }
    }
  }

  for (const product of products) {
    const stat = stats.get(product.id)!;
    stat.orders = Math.max(stat.orders, paidCounts.get(product.id) ?? 0);
    // Revenue shown for a product comes only from real paid orders.
    stat.revenue = stat.revenue || 0;
  }

  let visitorsWeek = 0;
  let visitorsMonth = 0;
  let viewsWeek = 0;
  let viewsMonth = 0;
  let signupsWeek = 0;
  let signupsMonth = 0;
  let signInsWeek = 0;
  let signInsMonth = 0;

  if (access.admin) {
    const views = await readBoth(accessToken, (db) =>
      db.from("page_views").select("session_id, created_at").gte("created_at", monthAgo).limit(50_000),
    );
    const monthSessions = new Set<string>();
    const weekSessions = new Set<string>();
    for (const row of views.rows as { session_id: string | null; created_at: string }[]) {
      viewsMonth += 1;
      monthSessions.add(row.session_id || row.created_at);
      if (row.created_at >= weekAgo) {
        viewsWeek += 1;
        weekSessions.add(row.session_id || row.created_at);
      }
    }
    visitorsMonth = monthSessions.size;
    visitorsWeek = weekSessions.size;

    const profiles = await readBoth(accessToken, (db) => db.from("profiles").select("id, created_at"));
    const signupIds = new Set<string>();
    for (const row of profiles.rows as { id: string; created_at: string | null }[]) {
      if (!row.created_at) continue;
      signupIds.add(row.id);
      if (row.created_at >= monthAgo) signupsMonth += 1;
      if (row.created_at >= weekAgo) signupsWeek += 1;
    }

    try {
      const auth = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const user of auth.data.users) {
        if (signupIds.has(user.id)) continue;
        if (user.created_at >= monthAgo) signupsMonth += 1;
        if (user.created_at >= weekAgo) signupsWeek += 1;
        if (user.last_sign_in_at) {
          if (user.last_sign_in_at >= monthAgo) signInsMonth += 1;
          if (user.last_sign_in_at >= weekAgo) signInsWeek += 1;
        }
      }
    } catch {
      // Auth admin may be unavailable when the privileged key is not valid; profile counts remain usable.
    }
  }

  // Do not silently report an apparently healthy all-zero dashboard when every source failed.
  const hasData = products.length > 0 || orders.length > 0 || visitorsMonth > 0 || signupsMonth > 0;
  if (!hasData && (productRead.privilegedError || orderRead.privilegedError)) {
    throw new Error(
      `Analytics backend read failed. Products: ${productRead.privilegedError ?? "no rows"}. Orders: ${orderRead.privilegedError ?? "no rows"}. Check that Vercel Supabase URL and key belong to the same project.`,
    );
  }

  return {
    scope: access.admin ? "admin" : "seller",
    productCount: products.length,
    activeProductCount: products.filter((p) => p.active).length,
    totalOrders: Math.max(orders.length, [...stats.values()].reduce((n, p) => n + p.orders, 0)),
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
    daily: [...dailyMap.entries()].map(([day, values]) => ({ day, ...values })),
    allTimeSalesCount: Math.max(orders.length, [...stats.values()].reduce((n, p) => n + p.orders, 0)),
    allTimeRevenue: totalRevenue,
  };
}
