import { getDbClient, requireAdmin } from "./supabase.server";

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

/**
 * Lightweight collaborator list used by the admin UI.
 * It intentionally does not join analytics tables while rendering the list,
 * so a missing/legacy analytics column can never hide a successfully-created link.
 */
export async function listCollaboratorPartnersSafe(accessToken?: string) {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);

  const { data: links, error: linksError } = await db
    .from("collaborator_links")
    .select("id,code,name,user_id,email,active,created_at")
    .order("created_at", { ascending: false });
  if (linksError) throw new Error(`Could not load collaborator links: ${linksError.message}`);

  const rows = (links ?? []) as LinkRow[];
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles } = await db
    .from("profiles")
    .select("id,email,full_name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));

  const { data: accessRows, error: accessError } = await db
    .from("collaborator_partner_products")
    .select("user_id,product_id")
    .in("user_id", userIds);
  if (accessError)
    throw new Error(`Could not load collaborator product access: ${accessError.message}`);

  const productIdsByUser = new Map<string, string[]>();
  for (const row of accessRows ?? []) {
    const userId = String(row.user_id);
    const current = productIdsByUser.get(userId) ?? [];
    current.push(String(row.product_id));
    productIdsByUser.set(userId, current);
  }

  const allProductIds = [...new Set((accessRows ?? []).map((row) => String(row.product_id)))];
  let products: Product[] = [];
  if (allProductIds.length) {
    const { data: productRows, error: productsError } = await db
      .from("products")
      .select("id,title,category,price,active")
      .in("id", allProductIds);
    if (productsError)
      throw new Error(`Could not load collaborator products: ${productsError.message}`);
    products = (productRows ?? []) as Product[];
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const rowsByUser = new Map<string, LinkRow[]>();
  for (const row of rows)
    rowsByUser.set(row.user_id, [...(rowsByUser.get(row.user_id) ?? []), row]);

  return [...rowsByUser.entries()].map(([userId, userLinks]) => {
    const productIds = [...new Set(productIdsByUser.get(userId) ?? [])];
    const profile = profileMap.get(userId);

    return {
      user_id: userId,
      email: String(profile?.email ?? userLinks[0]?.email ?? ""),
      full_name: (profile?.full_name as string | null) ?? null,
      active: userLinks.some((link) => link.active),
      product_ids: productIds,
      products: productIds.map((id) => productsById.get(id)).filter(Boolean) as Product[],
      totals: { visitors: 0, page_views: 0, sales: 0, revenue: 0 },
      links: userLinks.map((link) => ({
        ...link,
        url: `/?ref=${link.code}`,
        visitors: 0,
        page_views: 0,
        sales: 0,
        revenue: 0,
      })),
    };
  });
}
