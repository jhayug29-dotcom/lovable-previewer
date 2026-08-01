import { supabase } from "@/integrations/supabase/client";
import { products as fallbackProducts, type Category, type Product, type Review } from "@/lib/products";

export type DbProduct = Product & { id?: string; banner?: string; downloadLink?: string };

export type Coupon = {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  active: boolean;
  sort_order: number;
};

export type Sale = {
  id: string;
  title: string;
  description: string | null;
  percent_off: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type Row = Record<string, unknown>;

function mapReview(row: Row): Review {
  return {
    name: String(row['name'] ?? "Anonymous"),
    handle: String(row['handle'] ?? ""),
    rating: Number(row['rating'] ?? 5),
    body: String(row['body'] ?? ""),
    date: new Date(String(row['created_at'] ?? Date.now())).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export function mapProduct(row: Row): DbProduct {
  const reviews = Array.isArray(row['reviews']) ? (row['reviews'] as Row[]).map(mapReview) : [];
  return {
    id: String(row['id'] ?? ""),
    slug: String(row['slug'] ?? ""),
    title: String(row['title'] ?? ""),
    tagline: String(row['tagline'] ?? ""),
    category: String(row['category'] ?? "After Effects") as Category,
    cover: String(row['cover_url'] ?? ""),
    ...(row['banner_url'] ? { banner: String(row['banner_url']) } : {}),
    ...(row['video_url'] ? { videoUrl: String(row['video_url']) } : {}),
    ...(row['download_link'] ? { downloadLink: String(row['download_link']) } : {}),
    isFree: Boolean(row['is_free']),
    price: Number(row['price'] ?? 0),
    originalPrice: Number(row['original_price'] ?? 0),
    rating: Number(row['rating'] ?? 5),
    reviewCount: reviews.length,
    sales: Number(row['sales'] ?? 0),
    ...(row['badge'] ? { badge: String(row['badge']) } : {}),
    fileInfo: (row['file_info'] as string[] | null) ?? [],
    description: String(row['description'] ?? ""),
    features: (row['features'] as string[] | null) ?? [],
    howToUse: (row['how_to_use'] as { step: string; detail: string }[] | null) ?? [],
    reviews,
  };
}

const SELECT = "*, reviews(*)";

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
