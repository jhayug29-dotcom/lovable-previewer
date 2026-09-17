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

  try {
    const [saleRes, bannerRes] = await Promise.all([
      db.from("sales").select("*").eq("active", true).order("created_at", { ascending: false }),
      db.from("banners").select("*").eq("active", true).order("sort_order", { ascending: true }),
    ]);

    if (saleRes.error || bannerRes.error) {
      console.warn(
        "[Store] Promo read unavailable; continuing without promo data:",
        saleRes.error?.message ?? bannerRes.error?.message,
      );
      return { sale: null, banners: [] };
    }

    const sales = ((saleRes.data ?? []) as StoreSale[]).filter((s) => isSaleLive(s));
    const banners = ((bannerRes.data ?? []) as StoreBanner[]).filter((b) => isBannerLive(b));
    return { sale: sales[0] ?? null, banners };
  } catch (error) {
    console.warn("[Store] Promo read failed; continuing without promo data:", error);
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

export async function loadProduct(slugOrId: string): Promise<DbProduct | null> {
  const raw = (slugOrId || "").trim();
  if (!raw) return null;

  const decoded = decodeURIComponent(raw).trim();
  const db = publicClient();

  if (db) {
    let data: Row | null = null;

    // 1. If it's a UUID, lookup by primary key ID first (100% exact, no collision possible)
    if (isUuid(decoded)) {
      const byId = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("id", decoded)
        .maybeSingle();
      if (!byId.error && byId.data) {
        data = byId.data as Row;
      }
    }

    // 2. Lookup by exact slug
    if (!data) {
      const bySlug = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .ilike("slug", decoded)
        .maybeSingle();
      if (!bySlug.error && bySlug.data) {
        data = bySlug.data as Row;
      }
    }

    // 3. Lookup by hyphen/space normalized slug (e.g. "Ae-Extention" vs "Ae Extention")
    if (!data) {
      const spaceVariant = decoded.replace(/-/g, " ");
      const hyphenVariant = decoded.replace(/\s+/g, "-");
      const byVariant = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .or(`slug.ilike."${spaceVariant}",slug.ilike."${hyphenVariant}"`)
        .maybeSingle();
      if (!byVariant.error && byVariant.data) {
        data = byVariant.data as Row;
      }
    }

    // 4. Lookup by exact title
    if (!data) {
      const byTitle = await db
        .from("products")
        .select(PRODUCT_SELECT)
        .ilike("title", decoded)
        .maybeSingle();
      if (!byTitle.error && byTitle.data) {
        data = byTitle.data as Row;
      }
    }

    if (data) {
      if (!Array.isArray(data["reviews"]) || data["reviews"].length === 0) {
        const { data: revs } = await db
          .from("reviews")
          .select("*")
          .eq("product_id", (data as Row).id)
          .order("created_at", { ascending: false });
        if (revs && revs.length > 0) (data as Row).reviews = revs;
      }
      const { sale } = await loadPromos();
      const product = mapProduct(data);
      return applySaleToAll([product], sale)[0] ?? null;
    }
  }

  // Fallback to static catalog with strict exact matching (NO fuzzy substring collisions)
  const all = await loadProducts();
  const targetLower = decoded.toLowerCase();
  const spaceVariant = decoded.replace(/-/g, " ").toLowerCase();
  const hyphenVariant = decoded.replace(/\s+/g, "-").toLowerCase();

  return (
    all.find((p) => {
      const pSlug = (p.slug || "").trim().toLowerCase();
      const pId = (p.id || "").trim().toLowerCase();
      const pTitle = (p.title || "").trim().toLowerCase();
      return (
        pId === targetLower ||
        pSlug === targetLower ||
        pSlug === spaceVariant ||
        pSlug === hyphenVariant ||
        pTitle === targetLower
      );
    }) ?? null
  );
}
