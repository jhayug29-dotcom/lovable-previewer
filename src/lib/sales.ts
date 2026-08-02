import type { DbProduct } from "@/lib/catalog-map";

export type StoreSale = {
  id: string;
  title: string;
  description: string | null;
  sale_type: "percent" | "flat";
  percent_off: number | null;
  flat_price: number | null;
  product_ids: string[];
  badge_label: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type StoreBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  emoji: string | null;
  cta_label: string | null;
  bg_from: string | null;
  bg_to: string | null;
  text_color: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

function withinWindow(startsAt: string | null, endsAt: string | null, now: number): boolean {
  if (startsAt && new Date(startsAt).getTime() > now) return false;
  if (endsAt && new Date(endsAt).getTime() < now) return false;
  return true;
}

export function isSaleLive(sale: StoreSale, now = Date.now()): boolean {
  return sale.active && withinWindow(sale.starts_at, sale.ends_at, now);
}

export function isBannerLive(banner: StoreBanner, now = Date.now()): boolean {
  return banner.active && withinWindow(banner.starts_at, banner.ends_at, now);
}

function saleAppliesTo(sale: StoreSale, product: DbProduct): boolean {
  const ids = sale.product_ids ?? [];
  if (ids.length === 0) return true;
  return Boolean(product.id && ids.includes(product.id));
}

/** Returns the product with sale pricing applied (never mutates the input). */
export function applySale(product: DbProduct, sale: StoreSale | null): DbProduct {
  if (!sale || !isSaleLive(sale) || product.isFree || !saleAppliesTo(sale, product)) return product;

  const base = product.price;
  let next = base;
  if (sale.sale_type === "flat" && sale.flat_price !== null) next = Math.max(0, Math.round(sale.flat_price));
  else if (sale.percent_off) next = Math.max(0, Math.round(base * (1 - sale.percent_off / 100)));

  if (next >= base) return product;

  return {
    ...product,
    price: next,
    originalPrice: Math.max(product.originalPrice ?? 0, base),
    ...(sale.badge_label ? { badge: sale.badge_label } : {}),
  };
}

export function applySaleToAll(products: DbProduct[], sale: StoreSale | null): DbProduct[] {
  if (!sale) return products;
  return products.map((p) => applySale(p, sale));
}
