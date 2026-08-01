import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { products as fallbackProducts } from "@/lib/products";
import { mapProduct, PRODUCT_SELECT, type DbProduct, type Row } from "@/lib/catalog-map";

const FALLBACK_URL = "https://wylcbblegcyzunychqqa.supabase.co";
const FALLBACK_KEY = "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV";

function env(name: string, fallback: string): string {
  return process.env[name] ?? process.env[`STORE_${name}`] ?? fallback;
}

let client: SupabaseClient | null = null;
function publicClient(): SupabaseClient {
  client ??= createClient(env("SUPABASE_URL", FALLBACK_URL), env("SUPABASE_PUBLISHABLE_KEY", FALLBACK_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Tiny per-isolate cache. Under traffic spikes hundreds of requests collapse
 * onto a single database read instead of one query per visitor.
 */
const TTL_MS = 30_000;
let cache: { at: number; products: DbProduct[] } | null = null;
let inflight: Promise<DbProduct[]> | null = null;

async function queryProducts(): Promise<DbProduct[]> {
  try {
    const { data, error } = await publicClient()
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return fallbackProducts as DbProduct[];
    return (data as Row[]).map(mapProduct);
  } catch {
    // Never let a backend hiccup take the storefront down.
    return fallbackProducts as DbProduct[];
  }
}

export async function loadProducts(): Promise<DbProduct[]> {
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

export async function loadProduct(slug: string): Promise<DbProduct | null> {
  const all = await loadProducts();
  return all.find((p) => p.slug === slug) ?? null;
}
