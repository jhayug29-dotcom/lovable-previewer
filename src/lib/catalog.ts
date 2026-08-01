import { supabase } from "@/integrations/supabase/client";
import { products as fallbackProducts } from "@/lib/products";
import { mapProduct, PRODUCT_SELECT, type Row } from "@/lib/catalog-map";

export { mapProduct } from "@/lib/catalog-map";
export type { DbProduct, Coupon, Banner, Sale } from "@/lib/catalog-map";

const SELECT = PRODUCT_SELECT;


/** Products from the database; falls back to the built-in demo catalog until the backend has rows. */
export async function fetchProducts(): Promise<DbProduct[]> {
  if (!supabase) return fallbackProducts;
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return fallbackProducts;
  return (data as Row[]).map(mapProduct);
}

export async function fetchProduct(slug: string): Promise<DbProduct | undefined> {
  if (!supabase) return fallbackProducts.find((p) => p.slug === slug);
  const { data, error } = await supabase.from("products").select(SELECT).eq("slug", slug).maybeSingle();
  if (error || !data) return fallbackProducts.find((p) => p.slug === slug);
  return mapProduct(data as Row);
}

export async function fetchBanners(): Promise<Banner[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("banners")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data as Banner[] | null) ?? [];
}

export async function fetchActiveSale(): Promise<Sale | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("sales")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Sale | null) ?? null;
}

/** Validates a coupon code client-side against the public coupons policy. */
export async function validateCoupon(code: string): Promise<Coupon | null> {
  if (!supabase || !code.trim()) return null;
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .ilike("code", code.trim())
    .eq("active", true)
    .maybeSingle();
  const coupon = data as Coupon | null;
  if (!coupon) return null;
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return null;
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return null;
  return coupon;
}
