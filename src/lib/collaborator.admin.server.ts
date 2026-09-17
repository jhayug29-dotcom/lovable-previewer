import {
  adminClient,
  getDbClient,
  getServiceRoleKey,
  requireAdmin,
  requireUser,
} from "./supabase.server";
import { autoHealCollaboratorOrders } from "./collaborator.engine.server";
import {
  getTimeframeBounds,
  type AnalyticsTimeframe,
  type TimeframeBounds,
} from "./timeframe";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);

type DbClient = ReturnType<typeof getDbClient>;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
type LinkRow = {
  id: string;
  code: string;
  name: string;
  user_id: string;
  email: string;
  active: boolean;
  created_at: string;
};

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const makeCode = () =>
  `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

function adminDb(_accessToken?: string): DbClient {
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
  const { data, error } = await db
    .from("collaborator_partner_products")
    .select("product_id")
    .eq("user_id", userId);
  if (error) throw error;
  return [...new Set(((data ?? []) as { product_id: string }[]).map((row) => row.product_id))];
}

export type RawPageView = {
  session_id: string | null;
  path: string;
  user_id: string | null;
  created_at: string;
  collaborator_code: string | null;
  collaborator_link_id: string | null;
};

export type RawOrder = {
  id: string;
  product_id: string | null;
  amount: number | string | null;
  status: string;
  user_id: string | null;
  customer_email: string | null;
  collaborator_link_id: string | null;
  created_at: string;
  paid_at?: string | null;
};

export function computeLinkStatsInMemory(
  link: LinkRow,
  allowedProductIds: string[],
  bounds: TimeframeBounds,
  allViews: RawPageView[],
  allOrders: RawOrder[],
) {
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const cleanCode = (link.code || "").toLowerCase();
  const cleanId = (link.id || "").toLowerCase();
  const cleanName = (link.name || "").trim().toLowerCase();
  const cleanEmail = (link.email || "").trim().toLowerCase();

  const linkSessions = new Set<string>();
  const attributedUserSet = new Set<string>();
  let page_views = 0;

  for (const v of allViews) {
    const vTime = new Date(v.created_at).getTime();
    if (vTime < startMs || vTime > endMs) continue;

    const vCode = (v.collaborator_code || "").toLowerCase();
    const vLinkId = (v.collaborator_link_id || "").toLowerCase();

    const matches =
      (vCode && (vCode === cleanCode || vCode === cleanId || (cleanName && vCode === cleanName))) ||
      (vLinkId && vLinkId === cleanId);

    if (matches) {
      page_views += 1;
      if (v.session_id) linkSessions.add(v.session_id);
      if (v.user_id) attributedUserSet.add(v.user_id);
    }
  }

  const visitors = linkSessions.size || (page_views > 0 ? 1 : 0);
  let signups = attributedUserSet.size;

  const allowed = allowedProductIds.length ? new Set(allowedProductIds) : null;
  let sales = 0;
  let revenue = 0;

  for (const o of allOrders) {
    const isPaid = PAID_STATUSES.has((o.status ?? "").toUpperCase());
    if (!isPaid) continue;

    const when = o.paid_at || o.created_at;
    const oTime = new Date(when).getTime();
    if (oTime < startMs || oTime > endMs) continue;

    const isDirect = (o.collaborator_link_id || "").toLowerCase() === cleanId;
    const isUserMatch = o.user_id ? attributedUserSet.has(o.user_id) : false;
    const isEmailMatch = Boolean(cleanEmail && (o.customer_email || "").toLowerCase() === cleanEmail);

    if (!isDirect && !isUserMatch && !isEmailMatch) continue;

    if (allowed && o.product_id && !allowed.has(o.product_id)) continue;

    sales += 1;
    revenue += Number(o.amount) || 0;
    if (o.user_id) attributedUserSet.add(o.user_id);
  }

  signups = Math.max(signups, attributedUserSet.size);

  return {
    visitors,
    page_views,
    signups,
    sales,
    revenue,
  };
}

async function safeStats(
  db: DbClient,
  link: LinkRow,
  allowedProductIds: string[],
  bounds?: TimeframeBounds,
  cachedViews?: RawPageView[],
  cachedOrders?: RawOrder[],
) {
  const activeBounds = bounds || getTimeframeBounds("1m");
  if (cachedViews && cachedOrders) {
    return computeLinkStatsInMemory(link, allowedProductIds, activeBounds, cachedViews, cachedOrders);
  }

  let visitors = 0;
  let page_views = 0;
  let signups = 0;
  let sales = 0;
  let revenue = 0;

  // 1. Safe page_views query (capturing code, link_id, or name match)
  const attributedUserSet = new Set<string>();
  try {
    const filters = [
      `collaborator_code.eq.${link.code}`,
      `collaborator_link_id.eq.${link.id}`,
      `collaborator_code.eq.${link.id}`,
    ];
    if (link.name && link.name.trim()) {
      filters.push(`collaborator_code.ilike.${link.name.trim()}`);
    }

    let viewQuery = db
      .from("page_views")
      .select("session_id, path, user_id, created_at, collaborator_code, collaborator_link_id")
      .or(filters.join(","))
      .limit(100000);

    if (activeBounds) {
      viewQuery = viewQuery.gte("created_at", activeBounds.startIso).lte("created_at", activeBounds.endIso);
    }

    const { data: views, error: viewError } = await viewQuery;

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
    console.warn("View stats fetch warning for link:", link.code, err);
  }

  // 2. Comprehensive orders query (attributing via link id, attributed user, or email)
  try {
    let orderQuery = db
      .from("orders")
      .select(
        "id, product_id, amount, status, user_id, customer_email, collaborator_link_id, created_at, paid_at",
      )
      .limit(100000);

    const { data: orders, error: orderError } = await orderQuery;

    if (!orderError && orders) {
      const allowed = new Set(allowedProductIds);
      const startMs = activeBounds.start.getTime();
      const endMs = activeBounds.end.getTime();

      const visibleOrders = (
        orders as RawOrder[]
      ).filter((order) => {
        const isPaid = PAID_STATUSES.has((order.status ?? "").toUpperCase());
        if (!isPaid) return false;

        const when = order.paid_at || order.created_at;
        const oTime = new Date(when).getTime();
        if (oTime < startMs || oTime > endMs) return false;

        const isDirect = (order.collaborator_link_id || "").toLowerCase() === link.id.toLowerCase();
        const isAttributedUser = order.user_id ? attributedUserSet.has(order.user_id) : false;
        const isAttributedEmail = Boolean(
          order.customer_email &&
          link.email &&
          order.customer_email.toLowerCase() === link.email.toLowerCase(),
        );

        if (!isDirect && !isAttributedUser && !isAttributedEmail) return false;

        if (allowedProductIds.length > 0 && order.product_id) {
          return allowed.has(order.product_id);
        }
        return true;
      });

      sales = visibleOrders.length;
      revenue = visibleOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
      const orderUsers = new Set(visibleOrders.map((o) => o.user_id).filter(Boolean));
      signups = Math.max(signups, orderUsers.size);
    }
  } catch (err) {
    console.warn("Order stats fetch warning for link:", link.id, err);
  }

  return {
    visitors,
    page_views,
    signups,
    sales,
    revenue,
  };
}

async function resolveUser(db: DbClient, email?: string, userId?: string) {
  let resolvedUserId = userId?.trim() || "";
  let resolvedEmail = email?.trim().toLowerCase() || "";

  if (resolvedUserId) {
    const { data: profile } = await db
      .from("profiles")
      .select("id,email")
      .eq("id", resolvedUserId)
      .maybeSingle();
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      try {
        const { data, error: authError } =
          await adminClient().auth.admin.getUserById(resolvedUserId);
        if (!authError && data?.user) {
          resolvedEmail = String(data.user.email ?? resolvedEmail).toLowerCase();
        }
      } catch {
        // Ignore auth error
      }
    }
  }

  if (!resolvedUserId && resolvedEmail) {
    const { data: profile } = await db
      .from("profiles")
      .select("id,email")
      .ilike("email", resolvedEmail)
      .maybeSingle();
    if (profile) {
      resolvedUserId = String(profile.id);
      resolvedEmail = String(profile.email ?? resolvedEmail).toLowerCase();
    } else if (getServiceRoleKey()) {
      try {
        const { data, error: authError } = await adminClient().auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (!authError && data?.users) {
          const match = data.users.find(
            (user) => String(user.email ?? "").toLowerCase() === resolvedEmail,
          );
          if (match) {
            resolvedUserId = match.id;
            resolvedEmail = String(match.email ?? resolvedEmail).toLowerCase();
          }
        }
      } catch {
        // Ignore user listing error
      }
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

  const { data: validProducts, error: productError } = await db
    .from("products")
    .select("id")
    .in("id", cleanProductIds);
  if (productError) throw productError;
  const validIds = new Set((validProducts ?? []).map((row) => String(row.id)));
  const invalidIds = cleanProductIds.filter((id) => !validIds.has(id));
  if (invalidIds.length) throw new Error("One or more selected products no longer exist");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: link, error: linkError } = await db
      .from("collaborator_links")
      .insert({
        name: name.trim(),
        email: recipient.email,
        user_id: recipient.userId,
        code: makeCode(),
        active: true,
      })
      .select("id,code,name,user_id,email,active,created_at")
      .single();

    if (!linkError && link) {
      if (cleanProductIds.length > 0) {
        try {
          const { data: existing } = await db
            .from("collaborator_partner_products")
            .select("product_id")
            .eq("user_id", recipient.userId);
          const existingSet = new Set(
            ((existing ?? []) as { product_id: string }[]).map((r) => String(r.product_id)),
          );
          const toAdd = cleanProductIds.filter((pid) => !existingSet.has(pid));

          if (toAdd.length > 0) {
            const { error: accessError } = await db
              .from("collaborator_partner_products")
              .insert(toAdd.map((product_id) => ({ user_id: recipient.userId, product_id })));
            if (accessError && accessError.code !== "23505") {
              console.warn(
                "Non-fatal collaborator product access map warning:",
                accessError.message,
              );
            }
          }
        } catch (err) {
          console.warn("Product access map warning:", err);
        }
      }
      return { ...link, url: `/?ref=${link.code}` };
    }

    if (linkError?.code === "23505" && String(linkError.message).toLowerCase().includes("code"))
      continue;
    if (linkError?.code === "23505")
      throw new Error("A collaborator link with that data already exists. Choose another name.");
    if (linkError) throw new Error(`Could not create collaborator: ${linkError.message}`);
  }

  throw new Error("Could not generate a unique referral code. Please try again.");
}

export async function setCollaboratorProductAccessAdmin(
  accessToken: string | undefined,
  userId: string,
  productIds: string[],
) {
  await requireAdmin(accessToken);
  const db = adminDb(accessToken);
  const clean = [...new Set(productIds.filter(Boolean))];

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

export async function listCollaboratorPartnersAdmin(
  accessToken?: string,
  timeframe: AnalyticsTimeframe = "1m",
  customStart?: string | null,
  customEnd?: string | null,
) {
  await requireAdmin(accessToken);
  await autoHealCollaboratorOrders().catch(() => {});
  const bounds = getTimeframeBounds(timeframe, customStart, customEnd);
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
    ? await db
        .from("collaborator_partner_products")
        .select("user_id,product_id")
        .in("user_id", userIds)
    : { data: [] as { user_id: string; product_id: string }[] };
  const productIdsByUser = new Map<string, string[]>();
  for (const row of (accessRows ?? []) as { user_id: string; product_id: string }[]) {
    productIdsByUser.set(row.user_id, [
      ...new Set([...(productIdsByUser.get(row.user_id) ?? []), row.product_id]),
    ]);
  }

  const result = [] as Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    active: boolean;
    product_ids: string[];
    products: Product[];
    timeframe: string;
    timeframeLabel: string;
    totals: {
      visitors: number;
      page_views: number;
      signups: number;
      sales: number;
      revenue: number;
    };
    links: Array<
      LinkRow & {
        url: string;
        visitors: number;
        page_views: number;
        signups: number;
        sales: number;
        revenue: number;
      }
    >;
  }>;

  // Batch fetch page_views and orders once for sub-millisecond memory aggregation
  let viewQuery = db
    .from("page_views")
    .select("session_id, path, user_id, created_at, collaborator_code, collaborator_link_id")
    .limit(100_000);

  if (bounds) {
    viewQuery = viewQuery.gte("created_at", bounds.startIso).lte("created_at", bounds.endIso);
  }
  const { data: allViewsData } = await viewQuery;
  const allViews = (allViewsData ?? []) as RawPageView[];

  const { data: allOrdersData } = await db
    .from("orders")
    .select(
      "id, product_id, amount, status, user_id, customer_email, collaborator_link_id, created_at, paid_at",
    )
    .limit(100_000);
  const allOrders = (allOrdersData ?? []) as RawOrder[];

  for (const userId of userIds) {
    const productIds = productIdsByUser.get(userId) ?? [];
    const userRows = rows.filter((row) => row.user_id === userId);
    const links = await Promise.all(
      userRows.map(async (row) => ({
        ...row,
        url: `/?ref=${row.code}`,
        ...(await safeStats(db, row, productIds, bounds, allViews, allOrders)),
      })),
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
      email: String(profile?.email ?? userRows[0]?.email ?? ""),
      full_name: profile?.full_name ?? null,
      active: links.some((link) => link.active),
      product_ids: productIds,
      products: await getProducts(db, productIds),
      timeframe: bounds.timeframe,
      timeframeLabel: bounds.label,
      totals,
      links,
    });
  }

  return result;
}

export async function getCollaboratorDashboardAdmin(
  accessToken?: string,
  timeframe: AnalyticsTimeframe = "1m",
  customStart?: string | null,
  customEnd?: string | null,
) {
  const user = await requireUser(accessToken);
  await autoHealCollaboratorOrders().catch(() => {});
  const bounds = getTimeframeBounds(timeframe, customStart, customEnd);
  const db = adminDb(accessToken);
  const userEmail = (user.email ?? "").trim().toLowerCase();

  let linkQuery = db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });

  if (userEmail) {
    linkQuery = linkQuery.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
  } else {
    linkQuery = linkQuery.eq("user_id", user.id);
  }

  const { data: linkRows, error: linkError } = await linkQuery;
  if (linkError) throw linkError;

  const rows = (linkRows ?? []) as LinkRow[];
  const activeLinks = rows.filter((link) => link.active);
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
    console.warn("Collaborator dashboard auto-sync notice:", healErr);
  }

  const userIdsToCheck = [...new Set([user.id, ...activeLinks.map((l) => l.user_id)])];
  const { data: accessData } = await db
    .from("collaborator_partner_products")
    .select("product_id")
    .in("user_id", userIdsToCheck);
  const productIds = [
    ...new Set(((accessData ?? []) as { product_id: string }[]).map((r) => r.product_id)),
  ];

  // Batch fetch views and orders once for collaborator dashboard
  let dashViewQuery = db
    .from("page_views")
    .select("session_id, path, user_id, created_at, collaborator_code, collaborator_link_id")
    .limit(100_000);
  if (bounds) {
    dashViewQuery = dashViewQuery.gte("created_at", bounds.startIso).lte("created_at", bounds.endIso);
  }
  const { data: dashViewsData } = await dashViewQuery;
  const dashViews = (dashViewsData ?? []) as RawPageView[];

  const { data: dashOrdersData } = await db
    .from("orders")
    .select(
      "id, product_id, amount, status, user_id, customer_email, collaborator_link_id, created_at, paid_at",
    )
    .limit(100_000);
  const dashOrders = (dashOrdersData ?? []) as RawOrder[];

  const products = await getProducts(db, productIds);
  const links = await Promise.all(
    activeLinks.map(async (link) => ({
      ...link,
      url: `/?ref=${link.code}`,
      ...(await safeStats(db, link, productIds, bounds, dashViews, dashOrders)),
    })),
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

  return {
    userId: user.id,
    email: user.email ?? links[0]?.email ?? null,
    timeframe: bounds.timeframe,
    timeframeLabel: bounds.label,
    startDate: bounds.startIso,
    endDate: bounds.endIso,
    links,
    products,
    productIds,
    totals,
  };
}
