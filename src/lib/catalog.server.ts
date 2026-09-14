import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { products as fallbackProducts } from "@/lib/products";
import { mapProduct, PRODUCT_SELECT, type DbProduct, type Row } from "@/lib/catalog-map";
import {
  applySaleToAll,
  isBannerLive,
  isSaleLive,
  type StoreBanner,
  type StoreSale,
} from "@/lib/sales";
import { getSupabaseKey, getSupabaseUrl, isSupabaseServerConfigured } from "./supabase.server";

function publicClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  return createClient(getSupabaseUrl(), getSupabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TTL_MS = 0;
let cache: { at: number; products: DbProduct[] } | null = null;
let inflight: Promise<DbProduct[]> | null = null;

export function clearCatalogCache(): void {
  cache = null;
  inflight = null;
  promoCache = null;
}

async function queryProducts(): Promise<DbProduct[]> {
  const client = publicClient();
  if (!client) return fallbackProducts;

  let { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    const basic = await client
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (!basic.error && basic.data) {
      data = basic.data;
      error = null;
    }
  }

  if (error) throw new Error(`Store product read failed: ${error.message}`);
  if (!data) throw new Error("Store product read returned no data");
  if (data.length === 0) return [];
  return (data as Row[]).map(mapProduct);
}

async function loadRawProducts(): Promise<DbProduct[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.products;
  inflight ??= queryProducts()
    .then((products) => {
      cache = { at: Date.now(), products };
      return products;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export type Promos = { sale: StoreSale | null; banners: StoreBanner[] };
let promoCache: { at: number; promos: Promos } | null = null;

async function queryPromos(): Promise<Promos> {
  const db = publicClient();
  if (!db) return { sale: null, banners: [] };

  const [saleRes, bannerRes] = await Promise.all([
    db.from("sales").select("*").eq("active", true).order("created_at", { ascending: false }),
    db.from("banners").select("*").eq("active", true).order("sort_order", { ascending: true }),
  ]);

  if (saleRes.error) throw new Error(`Store sale read failed: ${saleRes.error.message}`);
  if (bannerRes.error) throw new Error(`Store banner read failed: ${bannerRes.error.message}`);

  const sales = ((saleRes.data ?? []) as StoreSale[]).filter((s) => isSaleLive(s));
  const banners = ((bannerRes.data ?? []) as StoreBanner[]).filter((b) => isBannerLive(b));
  return { sale: sales[0] ?? null, banners };
}

export async function loadPromos(): Promise<Promos> {
  const now = Date.now();
  if (promoCache && now - promoCache.at < TTL_MS) return promoCache.promos;
  const promos = await queryPromos();
  promoCache = { at: Date.now(), promos };
  return promos;
}

export async function loadProducts(): Promise<DbProduct[]> {
  const [products, { sale }] = await Promise.all([loadRawProducts(), loadPromos()]);
  return applySaleToAll(products, sale);
}

export type ProductSection = {
  id: string;
  product_id: string;
  title: string;
  content: string;
  sort_order: number;
  enabled: boolean;
};

export async function loadProductSections(productId: string): Promise<ProductSection[]> {
  const db = publicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("product_sections")
    .select("id, product_id, title, content, sort_order, enabled")
    .eq("product_id", productId)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Product sections read failed: ${error.message}`);
  return (data as ProductSection[] | null) ?? [];
}

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function loadProduct(slug: string): Promise<DbProduct | null> {
  const rawSlug = (slug || "").trim();
  const decoded = decodeURIComponent(rawSlug).trim();
  const spaceVariant = decoded.replace(/-/g, " ");
  const hyphenVariant = decoded.replace(/\s+/g, "-");

  const db = publicClient();
  if (db) {
    const orClauses = [
      `slug.eq."${decoded}"`,
      `slug.ilike."${decoded}"`,
      `slug.ilike."${spaceVariant}"`,
      `slug.ilike."${hyphenVariant}"`,
    ];
    if (isUuid(decoded)) orClauses.push(`id.eq."${decoded}"`);

    let { data, error } = await db
      .from("products")
      .select(PRODUCT_SELECT)
      .or(orClauses.join(","))
      .eq("active", true)
      .maybeSingle();

    if (error) {
      const basic = await db
        .from("products")
        .select("*")
        .or(orClauses.join(","))
        .eq("active", true)
        .maybeSingle();
      if (!basic.error) {
        data = basic.data;
        error = null;
      }
    }

    if (error) throw new Error(`Product read failed: ${error.message}`);

    if (
      data &&
      (!Array.isArray((data as Row)["reviews"]) || (data as Row)["reviews"].length === 0)
    ) {
      const { data: revs, error: reviewError } = await db
        .from("reviews")
        .select("*")
        .eq("product_id", (data as Row).id)
        .order("created_at", { ascending: false });
      if (!reviewError && revs && revs.length > 0) (data as Row).reviews = revs;
    }

    if (data) {
      const { sale } = await loadPromos();
      const product = mapProduct(data as Row);
      return applySaleToAll([product], sale)[0] ?? null;
    }

    return null;
  }

  const all = await loadProducts();
  const targetLower = decoded.toLowerCase();
  const targetSpace = spaceVariant.toLowerCase();
  const targetHyphen = hyphenVariant.toLowerCase();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normTarget = normalize(decoded);

  return (
    all.find((p) => {
      const pSlug = (p.slug || "").trim().toLowerCase();
      const pId = (p.id || "").trim();
      const pNorm = normalize(p.slug || "");
      const titleNorm = normalize(p.title || "");
      return (
        pSlug === targetLower ||
        pSlug === targetSpace ||
        pSlug === targetHyphen ||
        pId === decoded ||
        p.title.toLowerCase() === targetLower ||
        pNorm === normTarget ||
        (normTarget.length >= 4 && (pNorm.includes(normTarget) || normTarget.includes(pNorm))) ||
        (normTarget.length >= 4 &&
          (titleNorm.includes(normTarget) || normTarget.includes(titleNorm.slice(0, 10))))
      );
    }) ?? null
  );
}
