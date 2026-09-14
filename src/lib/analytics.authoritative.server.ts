import { adminClient } from "./supabase.server";
import { panelAccess, type Analytics, type ProductStat } from "./analytics.server";
import { intelligentResolveCollaborator } from "./collaborator.engine.server";

const DAY = 86_400_000;
const PAID_STATUSES = new Set(["PAID", "SUCCESS", "FREE", "COMPLETED", "CAPTURED"]);

function isPaid(status: string | null | undefined) {
  return PAID_STATUSES.has(String(status ?? "").toUpperCase());
}

function cashfreeConfig() {
  const appId = process.env["CASHFREE_APP_ID"]?.trim();
  const secret = process.env["CASHFREE_SECRET_KEY"]?.trim();
  const mode =
    (process.env["CASHFREE_MODE"] ?? process.env["VITE_CASHFREE_MODE"] ?? "production").trim() ===
    "sandbox"
      ? "sandbox"
      : "production";
  if (!appId || !secret) return null;
  return {
    appId,
    secret,
    base: mode === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg",
  };
}

async function verifyCashfreeOrder(
  cfOrderId: string,
): Promise<"PAID" | "PENDING" | "FAILED" | null> {
  const cfg = cashfreeConfig();
  if (!cfg || !cfOrderId) return null;
  try {
    const response = await fetch(`${cfg.base}/orders/${encodeURIComponent(cfOrderId)}`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": cfg.appId,
        "x-client-secret": cfg.secret,
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as { order_status?: string };
    if (!response.ok) return null;
    const status = String(payload.order_status ?? "").toUpperCase();
    if (status === "PAID") return "PAID";
    if (status === "ACTIVE") return "PENDING";
    return "FAILED";
  } catch {
    return null;
  }
}

async function reconcilePendingOrders(db: ReturnType<typeof adminClient>) {
  const { data: pendingRows } = await db
    .from("orders")
    .select(
      "id, cf_order_id, product_id, collaborator_link_id, user_id, customer_email, amount, created_at, paid_at, status",
    )
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(50);

  let changed = 0;
  for (const order of pendingRows ?? []) {
    const cfStatus = await verifyCashfreeOrder(String(order.cf_order_id ?? ""));
    if (cfStatus === "PAID") {
      const resolved = order.collaborator_link_id
        ? null
        : await intelligentResolveCollaborator({
            userId: order.user_id,
            customerEmail: order.customer_email,
          }).catch(() => null);

      const { error } = await db
        .from("orders")
        .update({
          status: "PAID",
          paid_at: order.paid_at || order.created_at || new Date().toISOString(),
          ...(resolved?.id ? { collaborator_link_id: resolved.id } : {}),
        })
        .eq("id", order.id);
      if (!error) changed += 1;
    } else if (cfStatus === "FAILED") {
      await db.from("orders").update({ status: "FAILED" }).eq("id", order.id);
    }
  }
  return changed;
}

async function getPaidOrderStats(db: ReturnType<typeof adminClient>) {
  const { data: orderRows } = await db.from("orders").select("product_id, amount, status");
  const counts = new Map<string, number>();
  const revenue = new Map<string, number>();
  let totalOrders = 0;
  let totalRevenue = 0;

  for (const row of orderRows ?? []) {
    if (!isPaid(row.status)) continue;
    totalOrders += 1;
    const amount = Number(row.amount) || 0;
    totalRevenue += amount;
    if (row.product_id) {
      counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
      revenue.set(row.product_id, (revenue.get(row.product_id) ?? 0) + amount);
    }
  }

  return { counts, revenue, totalOrders, totalRevenue };
}

async function syncSalesCounters(
  db: ReturnType<typeof adminClient>,
  products: { id: string; sales?: number | null }[],
  paidCounts: Map<string, number>,
) {
  // Never destroy previously recorded sales because a temporary DB/RLS/connection
  // issue returned an incomplete set of orders. Historical counters are preserved;
  // only confirmed paid orders can increase them.
  for (const product of products) {
    const previous = Math.max(0, Number(product.sales ?? 0));
    const confirmed = paidCounts.get(product.id) ?? 0;
    const expected = Math.max(previous, confirmed);
    if (expected > previous) {
      await db.from("products").update({ sales: expected }).eq("id", product.id);
    }
  }
}

export async function getAuthoritativeAnalytics(accessToken: string | undefined): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");

  // Admin analytics must use the privileged server client so RLS/user-scoped reads
  // cannot hide legitimate orders from the ledger.
  const db = adminClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  if (access.admin) {
    await reconcilePendingOrders(db);
  }

  const { data: productRows } = await db
    .from("products")
    .select("id, title, category, price, active, sales")
    .order("created_at", { ascending: false });

  const allProducts = (productRows ?? []) as {
    id: string;
    title: string;
    category: string;
    price: number;
    active: boolean;
    sales?: number | null;
  }[];

  const paidStats = await getPaidOrderStats(db);
  await syncSalesCounters(db, allProducts, paidStats.counts);

  const products = access.admin
    ? allProducts
    : allProducts.filter((p) => access.productIds.includes(p.id));
  const allowed = new Set(products.map((p) => p.id));

  const { data: orderRows } = await db
    .from("orders")
    .select(
      "id, product_id, amount, status, created_at, paid_at, coupon_code, user_id, customer_email, collaborator_link_id",
    )
    .order("created_at", { ascending: false });

  if (access.admin) {
    for (const row of orderRows ?? []) {
      if (!isPaid(row.status) || row.collaborator_link_id) continue;
      const resolved = await intelligentResolveCollaborator({
        userId: row.user_id,
        customerEmail: row.customer_email,
      }).catch(() => null);
      if (resolved?.id) {
        await db.from("orders").update({ collaborator_link_id: resolved.id }).eq("id", row.id);
      }
    }
  }

  const orders = (orderRows ?? []).filter(
    (o) => isPaid(o.status) && (access.admin || (o.product_id && allowed.has(o.product_id))),
  );

  const stats = new Map<string, ProductStat>(
    products.map((p) => {
      const persistedSales = Math.max(0, Number(p.sales) || 0);
      const confirmedOrders = paidStats.counts.get(p.id) ?? 0;
      const confirmedRevenue = paidStats.revenue.get(p.id) ?? 0;
      return [
        p.id,
        {
          productId: p.id,
          title: p.title,
          category: p.category,
          price: Number(p.price) || 0,
          active: Boolean(p.active),
          orders: Math.max(persistedSales, confirmedOrders),
          revenue: Math.max(confirmedRevenue, persistedSales * (Number(p.price) || 0)),
        },
      ];
    }),
  );

  const dayBuckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    dayBuckets.set(key, { orders: 0, revenue: 0 });
  }

  let orderRevenue = 0;
  let ordersThisMonth = 0;
  let revenueThisMonth = 0;
  let ordersThisWeek = 0;
  let revenueThisWeek = 0;

  const categories = new Map<string, { category: string; orders: number; revenue: number }>();

  for (const order of orders) {
    const amount = Number(order.amount) || 0;
    orderRevenue += amount;
    const when = order.paid_at || order.created_at;
    const timestamp = new Date(when).getTime();
    const day = String(when).slice(0, 10);

    if (timestamp >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
    }
    if (timestamp >= now - 7 * DAY) {
      ordersThisWeek += 1;
      revenueThisWeek += amount;
    }

    const bucket = dayBuckets.get(day);
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue += amount;
    }

    if (order.product_id) {
      const stat = stats.get(order.product_id);
      if (stat) {
        const category = categories.get(stat.category) ?? {
          category: stat.category,
          orders: 0,
          revenue: 0,
        };
        category.orders += 1;
        category.revenue += amount;
        categories.set(stat.category, category);
      }
    }
  }

  const persistedTotalOrders = [...stats.values()].reduce((sum, p) => sum + p.orders, 0);
  const persistedTotalRevenue = [...stats.values()].reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders = Math.max(orders.length, persistedTotalOrders);
  const totalRevenue = Math.max(orderRevenue, persistedTotalRevenue);

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
    for (const v of viewRows ?? []) {
      viewsMonth += 1;
      monthSessions.add(v.session_id || v.created_at);
      if (v.created_at >= weekAgo) {
        viewsWeek += 1;
        weekSessions.add(v.session_id || v.created_at);
      }
    }
    visitorsMonth = monthSessions.size;
    visitorsWeek = weekSessions.size;

    const { data: profiles } = await db.from("profiles").select("id, created_at");
    for (const p of profiles ?? []) {
      if (!p.created_at) continue;
      if (p.created_at >= monthAgo) signupsMonth += 1;
      if (p.created_at >= weekAgo) signupsWeek += 1;
    }

    const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of users?.users ?? []) {
      if (user.created_at >= monthAgo) signupsMonth += 1;
      if (user.created_at >= weekAgo) signupsWeek += 1;
      if (user.last_sign_in_at) {
        if (user.last_sign_in_at >= monthAgo) signInsMonth += 1;
        if (user.last_sign_in_at >= weekAgo) signInsWeek += 1;
      }
    }
  }

  const daily = [...dayBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ day, ...values }));

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
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    daily,
    allTimeSalesCount: totalOrders,
    allTimeRevenue: totalRevenue,
  };
}
