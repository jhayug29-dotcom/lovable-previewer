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

function env(name: string): string | undefined {
  return process.env[name] ?? process.env[`STORE_${name}`];
}

function isSupabaseConfigured(): boolean {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key =
    env("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    env("VITE_SUPABASE_ANON_KEY") ??
    env("SUPABASE_PUBLISHABLE_KEY") ??
    env("SUPABASE_ANON_KEY");
  return Boolean(url && key);
}

function publicClient(): SupabaseClient | null {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key =
    env("SUPABASE_SERVICE_ROLE_KEY") ??
    env("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    env("VITE_SUPABASE_ANON_KEY") ??
    env("SUPABASE_PUBLISHABLE_KEY") ??
    env("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const TTL_MS = 30_000;
let cache: { at: number; products: DbProduct[] } | null = null;
let inflight: Promise<DbProduct[]> | null = null;

export function clearCatalogCache(): void {
  cache = null;
  inflight = null;
}

async function queryProducts(): Promise<DbProduct[]> {
  const client = publicClient();
  if (!client) {
    return fallbackProducts;
  }
  try {
    let { data, error } = await client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    // If joined reviews(*) failed (e.g. FK relation or RLS constraint), query products directly
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

    if (error || !data || data.length === 0) return fallbackProducts;
    return (data as Row[]).map(mapProduct);
  } catch (err) {
    console.warn("Failed to query products from database, using fallback catalog:", err);
    return fallbackProducts;
  }
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
  try {
    const [saleRes, bannerRes] = await Promise.all([
      db.from("sales").select("*").eq("active", true).order("created_at", { ascending: false }),
      db.from("banners").select("*").eq("active", true).order("sort_order", { ascending: true }),
    ]);
    const sales = ((saleRes.data ?? []) as StoreSale[]).filter((s) => isSaleLive(s));
    const banners = ((bannerRes.data ?? []) as StoreBanner[]).filter((b) => isBannerLive(b));
    return { sale: sales[0] ?? null, banners };
  } catch {
    return { sale: null, banners: [] };
  }
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
  try {
    const { data } = await db
      .from("product_sections")
      .select("id, product_id, title, content, sort_order, enabled")
      .eq("product_id", productId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return (data as ProductSection[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function loadProduct(slug: string): Promise<DbProduct | null> {
  const rawSlug = (slug || "").trim();
  const decoded = decodeURIComponent(rawSlug).trim();
  const spaceVariant = decoded.replace(/-/g, " ");
  const hyphenVariant = decoded.replace(/\s+/g, "-");

  const db = publicClient();
  if (db) {
    try {
      let { data, error } = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .or(
          `slug.eq."${decoded}",slug.ilike."${decoded}",slug.ilike."${spaceVariant}",slug.ilike."${hyphenVariant}",id.eq."${decoded}"`,
        )
        .eq("active", true)
        .maybeSingle();

      if (error) {
        const basic = await db
          .from("products")
          .select("*")
          .or(
            `slug.eq."${decoded}",slug.ilike."${decoded}",slug.ilike."${spaceVariant}",slug.ilike."${hyphenVariant}",id.eq."${decoded}"`,
          )
          .eq("active", true)
          .maybeSingle();
        if (!basic.error && basic.data) {
          data = basic.data;
          error = null;
        }
      }

      if (data && (!Array.isArray((data as Row)["reviews"]) || (data as Row)["reviews"].length === 0)) {
        try {
          const { data: revs } = await db
            .from("reviews")
            .select("*")
            .eq("product_id", (data as Row).id)
            .order("created_at", { ascending: false });
          if (revs && revs.length > 0) {
            (data as Row).reviews = revs;
          }
        } catch {
          // ignore
        }
      }

      if (!error && data) {
        const [{ sale }] = await Promise.all([loadPromos()]);
        const product = mapProduct(data as Row);
        return applySaleToAll([product], sale)[0] ?? null;
      }
    } catch {
      // Fall through to the cached catalog fallback.
    }
  }
  const all = await loadProducts();
  const targetLower = decoded.toLowerCase();
  const targetSpace = spaceVariant.toLowerCase();
  const targetHyphen = hyphenVariant.toLowerCase();

  return (
    all.find((p) => {
      const pSlug = (p.slug || "").trim().toLowerCase();
      const pId = (p.id || "").trim();
      return (
        pSlug === targetLower ||
        pSlug === targetSpace ||
        pSlug === targetHyphen ||
        pId === decoded ||
        p.title.toLowerCase() === targetLower
      );
    }) ?? null
  );
}
