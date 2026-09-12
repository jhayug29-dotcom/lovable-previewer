import { adminClient, getDbClient, requireAdmin, requireUser } from "./supabase.server";

const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"]);

const code = () =>
  `${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}${Date.now().toString(36)}`;

export type CollaboratorLink = {
  id: string;
  code: string;
  name: string;
  user_id: string;
  email: string;
  active: boolean;
  created_at: string;
  url: string;
  visitors: number;
  page_views: number;
  sales: number;
  revenue: number;
};

export type CollaboratorStats = {
  visitors: number;
  page_views: number;
  sales: number;
  revenue: number;
};

async function statsForLink(id: string, collaboratorCode: string): Promise<CollaboratorStats> {
  const db = adminClient();

  const [{ data: views }, { data: orders }] = await Promise.all([
    db
      .from("page_views")
      .select("session_id")
      .eq("collaborator_code", collaboratorCode)
      .limit(100_000),
    db
      .from("orders")
      .select("id, amount, status")
      .eq("collaborator_link_id", id)
      .limit(100_000),
  ]);

  const uniqueVisitors = new Set(
    ((views ?? []) as { session_id: string | null }[])
      .map((row) => row.session_id)
      .filter((value): value is string => Boolean(value)),
  );

  const paidOrders = ((orders ?? []) as { id: string; amount: number | string | null; status: string }[]).filter(
    (order) => PAID_STATUSES.has((order.status ?? "").toUpperCase()),
  );

  return {
    visitors: uniqueVisitors.size,
    page_views: (views ?? []).length,
    sales: paidOrders.length,
    revenue: paidOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0),
  };
}

export async function listCollaboratorLinks(accessToken?: string): Promise<CollaboratorLink[]> {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);
  const { data, error } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Omit<CollaboratorLink, "url" | "visitors" | "page_views" | "sales" | "revenue">[];
  const withStats = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      url: `/?ref=${row.code}`,
      ...(await statsForLink(row.id, row.code)),
    })),
  );
  return withStats;
}

export async function createCollaboratorLink(
  accessToken: string | undefined,
  name: string,
  email: string,
) {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);
  const normalizedEmail = email.trim().toLowerCase();

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,email")
    .ilike("email", normalizedEmail)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("No registered user was found for that email");

  const cleanName = name.trim();
  const { data, error } = await db
    .from("collaborator_links")
    .insert({
      name: cleanName,
      email: normalizedEmail,
      user_id: profile.id,
      code: code(),
      active: true,
    })
    .select("id,code,name,user_id,email,active,created_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("That user already has a collaborator link with this name");
    }
    throw error;
  }
  return { ...data, url: `/?ref=${data.code}` };
}

export async function toggleCollaboratorLink(
  accessToken: string | undefined,
  id: string,
  active: boolean,
) {
  await requireAdmin(accessToken);
  const { data, error } = await getDbClient(accessToken)
    .from("collaborator_links")
    .update({ active })
    .eq("id", id)
    .select("id,active")
    .single();
  if (error) throw error;
  return data;
}

export async function getCollaboratorLinkStats(
  accessToken: string | undefined,
  id: string,
): Promise<CollaboratorStats> {
  await requireAdmin(accessToken);
  const { data: link, error } = await adminClient()
    .from("collaborator_links")
    .select("id,code")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new Error("Collaborator link not found");
  return statsForLink(link.id, link.code);
}

export async function getCollaboratorDashboard(accessToken?: string) {
  const user = await requireUser(accessToken);
  const db = adminClient();
  const { data: links, error } = await db
    .from("collaborator_links")
    .select("id,code,name,email,active,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  if (!links || links.length === 0) {
    throw new Error("Collaborator access has not been assigned to this account");
  }

  const scopedLinks = await Promise.all(
    links.map(async (link) => ({
      ...link,
      url: `/?ref=${link.code}`,
      ...(await statsForLink(link.id, link.code)),
    })),
  );

  return {
    links: scopedLinks,
    totals: scopedLinks.reduce(
      (sum, link) => ({
        visitors: sum.visitors + link.visitors,
        page_views: sum.page_views + link.page_views,
        sales: sum.sales + link.sales,
        revenue: sum.revenue + link.revenue,
      }),
      { visitors: 0, page_views: 0, sales: 0, revenue: 0 },
    ),
  };
}
