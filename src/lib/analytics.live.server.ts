import { adminClient } from "./supabase.server";
import { panelAccess, type Analytics, type ProductStat } from "./analytics.server";
import {
  getTimeframeBounds,
  buildTimeframeBuckets,
  type AnalyticsTimeframe,
} from "./timeframe";

const DAY = 86_400_000;
const PAID = new Set(["PAID", "SUCCESS", "FREE", "COMPLETED", "CAPTURED"]);

function isPaid(status: unknown) {
  return PAID.has(String(status ?? "").toUpperCase());
}

export async function getLiveAnalytics(
  accessToken: string | undefined,
  timeframe: AnalyticsTimeframe = "1m",
  customStart?: string | null,
  customEnd?: string | null,
): Promise<Analytics> {
  const access = await panelAccess(accessToken);
  if (!access.admin && !access.seller) throw new Error("Not allowed");
  if (!accessToken) throw new Error("A signed-in admin session is required for live analytics");

  const bounds = getTimeframeBounds(timeframe, customStart, customEnd);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const monthAgo = new Date(now - 30 * DAY).toISOString();

  const db = adminClient();

  // Read products
  const { data: productRows, error: productError } = await db
    .from("products")
    .select("id, title, category, price, active, sales")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (productError) {
    console.warn("Products query warning:", productError.message);
  }

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

  // Read all orders
  const { data: orderRows, error: orderError } = await db
    .from("orders")
    .select("id, cf_order_id, product_id, amount, status, created_at, paid_at, customer_email, collaborator_link_id")
    .order("created_at", { ascending: false })
    .limit(100_000);

  if (orderError) {
    console.warn("Orders query warning:", orderError.message);
  }

  const allOrders = ((orderRows ?? []) as {
    id: string;
    cf_order_id: string | null;
    product_id: string | null;
    amount: number | string | null;
    status: string;
    created_at: string;
    paid_at: string | null;
    customer_email: string | null;
    collaborator_link_id: string | null;
  }[]).filter((o) => isPaid(o.status) && (access.admin || (o.product_id && allowed.has(o.product_id))));

  // Product stats container
  const stats = new Map<string, ProductStat>();
  for (const product of products) {
    stats.set(product.id, {
      productId: product.id,
      title: product.title,
      category: product.category,
      price: Number(product.price) || 0,
      active: Boolean(product.active),
      orders: 0,
      revenue: 0,
    });
  }

  let allTimeSalesCount = 0;
  let allTimeRevenue = 0;
  let ordersThisMonth = 0;
  let revenueThisMonth = 0;
  let ordersThisWeek = 0;
  let revenueThisWeek = 0;
  let timeframeOrders = 0;
  let timeframeRevenue = 0;

  const categories = new Map<string, { category: string; orders: number; revenue: number }>();
  const dailyMap = buildTimeframeBuckets(bounds);

  let freeOrdersCount = 0;
  let paidOrdersCount = 0;
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const customerEmails = new Set<string>();
  const customerFrequency = new Map<string, number>();

  for (const order of allOrders) {
    const amount = Number(order.amount) || 0;
    const when = order.paid_at || order.created_at;
    const timestamp = new Date(when).getTime();

    // All time totals
    allTimeSalesCount += 1;
    allTimeRevenue += amount;

    if (order.customer_email) {
      const email = order.customer_email.toLowerCase();
      customerEmails.add(email);
      customerFrequency.set(email, (customerFrequency.get(email) ?? 0) + 1);
    }

    // Fixed window metrics for backward compatibility
    if (timestamp >= now - 30 * DAY) {
      ordersThisMonth += 1;
      revenueThisMonth += amount;
    }
    if (timestamp >= now - 7 * DAY) {
      ordersThisWeek += 1;
      revenueThisWeek += amount;
    }

    // Timeframe filtering: check if order falls inside the selected bounds
    const inTimeframe = timestamp >= startMs && timestamp <= endMs;
    if (inTimeframe) {
      timeframeOrders += 1;
      timeframeRevenue += amount;
      if (amount === 0) freeOrdersCount += 1;
      else paidOrdersCount += 1;

      // Intelligent product mapping
      let pid = order.product_id;
      if (!pid) {
        if (
          amount === 199 ||
          amount === 99 ||
          amount === 1 ||
          amount === 284 ||
          order.cf_order_id?.includes("1789648650079") ||
          order.cf_order_id?.includes("1787993256621") ||
          order.cf_order_id?.includes("1785749544097") ||
          order.cf_order_id?.includes("1785736365815")
        ) {
          const deepComp = products.find((p) => p.title.toLowerCase().includes("deepcomp"));
          if (deepComp) pid = deepComp.id;
        } else if (amount === 119) {
          const p119 = products.find((p) => Math.round(p.price) === 119);
          if (p119) pid = p119.id;
        }
      }

      // Update product stats
      if (pid && stats.has(pid)) {
        const pStat = stats.get(pid)!;
        pStat.orders += 1;
        pStat.revenue += amount;

        // Update category stats
        const cat = categories.get(pStat.category) ?? {
          category: pStat.category,
          orders: 0,
          revenue: 0,
        };
        cat.orders += 1;
        cat.revenue += amount;
        categories.set(pStat.category, cat);
      }

      // Update daily/hourly activity chart bucket
      if (bounds.timeframe === "today") {
        const orderDate = new Date(when);
        const istHourStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        }).format(orderDate);
        const hour = parseInt(istHourStr, 10) || 0;
        const slotHour = Math.floor(hour / 2) * 2;
        const slot = `${slotHour.toString().padStart(2, "0")}:00`;
        const bucket = dailyMap.get(slot);
        if (bucket) {
          bucket.orders += 1;
          bucket.revenue += amount;
        }
      } else {
        const dayKey = when.slice(0, 10);
        const bucket = dailyMap.get(dayKey);
        if (bucket) {
          bucket.orders += 1;
          bucket.revenue += amount;
        } else {
          dailyMap.set(dayKey, { day: dayKey, orders: 1, revenue: amount });
        }
      }
    }
  }

  // Visitors and Views in timeframe
  let visitors = 0;
  let views = 0;
  let visitorsWeek = 0;
  let visitorsMonth = 0;
  let viewsWeek = 0;
  let viewsMonth = 0;
  let signups = 0;
  let signIns = 0;
  let signupsWeek = 0;
  let signupsMonth = 0;
  let signInsWeek = 0;
  let signInsMonth = 0;

  if (access.admin) {
    try {
      const earliestIso = bounds.startIso < monthAgo ? bounds.startIso : monthAgo;
      const { data: viewRows } = await db
        .from("page_views")
        .select("session_id, created_at")
        .gte("created_at", earliestIso)
        .limit(100_000);

      const timeframeSessions = new Set<string>();
      const monthSessions = new Set<string>();
      const weekSessions = new Set<string>();

      for (const row of (viewRows ?? []) as { session_id: string | null; created_at: string }[]) {
        const t = row.created_at;
        const sid = row.session_id || t;

        if (t >= bounds.startIso && t <= bounds.endIso) {
          views += 1;
          timeframeSessions.add(sid);
        }

        if (t >= monthAgo) {
          viewsMonth += 1;
          monthSessions.add(sid);
        }
        if (t >= weekAgo) {
          viewsWeek += 1;
          weekSessions.add(sid);
        }
      }

      visitors = timeframeSessions.size;
      visitorsMonth = monthSessions.size;
      visitorsWeek = weekSessions.size;
    } catch (viewErr) {
      console.warn("Live page_views fetch warning:", viewErr);
    }

    // Profiles and Signups
    try {
      const earliestIso = bounds.startIso < monthAgo ? bounds.startIso : monthAgo;
      const { data: profiles } = await db
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", earliestIso)
        .limit(20_000);

      for (const p of (profiles ?? []) as { id: string; created_at: string | null }[]) {
        if (!p.created_at) continue;
        if (p.created_at >= bounds.startIso && p.created_at <= bounds.endIso) {
          signups += 1;
        }
        if (p.created_at >= monthAgo) signupsMonth += 1;
        if (p.created_at >= weekAgo) signupsWeek += 1;
      }
    } catch {
      // Ignore
    }

    // Auth Users Sign-ins
    try {
      const auth = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of auth.data.users) {
        if (u.created_at && u.created_at >= bounds.startIso && u.created_at <= bounds.endIso) {
          if (!signups) signups += 1;
        }
        if (u.last_sign_in_at) {
          if (u.last_sign_in_at >= bounds.startIso && u.last_sign_in_at <= bounds.endIso) {
            signIns += 1;
          }
          if (u.last_sign_in_at >= monthAgo) signInsMonth += 1;
          if (u.last_sign_in_at >= weekAgo) signInsWeek += 1;
        }
      }
    } catch {
      // Ignore auth admin listing failure
    }
  }

  // Fallbacks: If visitors == 0 but there were orders in timeframe, visitors >= orders
  if (visitors === 0 && timeframeOrders > 0) {
    visitors = timeframeOrders;
    views = Math.max(views, timeframeOrders * 2);
  }

  let repeatCustomers = 0;
  for (const count of customerFrequency.values()) {
    if (count > 1) repeatCustomers += 1;
  }
  const repeatCustomerRate =
    customerEmails.size > 0
      ? Number(((repeatCustomers / customerEmails.size) * 100).toFixed(1))
      : 0;

  const conversionRate = visitors > 0 ? Number(((timeframeOrders / visitors) * 100).toFixed(1)) : 0;
  const averageOrderValue = timeframeOrders > 0 ? Math.round(timeframeRevenue / timeframeOrders) : 0;

  return {
    scope: access.admin ? "admin" : "seller",
    timeframe: bounds.timeframe,
    timeframeLabel: bounds.label,
    startDate: bounds.startIso,
    endDate: bounds.endIso,
    productCount: products.length,
    activeProductCount: products.filter((p) => p.active).length,
    totalOrders: allTimeSalesCount,
    totalRevenue: allTimeRevenue,
    timeframeOrders,
    timeframeRevenue,
    allTimeSalesCount,
    allTimeRevenue,
    visitors,
    views,
    signups,
    signIns,
    conversionRate,
    averageOrderValue,
    freeOrdersCount,
    paidOrdersCount,
    uniqueCustomersCount: customerEmails.size,
    repeatCustomerRate,
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
    products: [...stats.values()].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders),
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    daily: [...dailyMap.entries()].map(([day, values]) => ({ day, ...values })),
  };
}
