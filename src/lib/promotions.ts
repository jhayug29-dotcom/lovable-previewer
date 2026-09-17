/**
 * Editly Store Promotions & Discount Engine
 *
 * Supports:
 * 1. Percentage-based discounts (% off all or selected products)
 * 2. Fixed-amount discounts (flat ₹ off or fixed price)
 * 3. Quantity discounts (e.g. 2 or more items get 20% off)
 * 4. Bundle deals (e.g. buying 3 specific products together for ₹499 or 30% off)
 * 5. Order value threshold offers (e.g. spend ₹1,000+ get ₹200 off or 15% off)
 *
 * Integrates seamlessly with coupon codes.
 */

export type PromotionType = "percent" | "flat" | "quantity" | "bundle" | "threshold";

export type PromotionRule = {
  id?: string;
  title: string;
  description: string;
  promoType: PromotionType;
  percentOff?: number | null;
  flatPrice?: number | null;
  discountAmount?: number | null;
  minQuantity?: number | null; // e.g. 2 for "buy 2 or more"
  minSpend?: number | null; // e.g. 1000 for "orders over ₹1000"
  bundleProductIds?: string[]; // specific products required for bundle
  productIds?: string[]; // target products (empty = whole store)
  badgeLabel?: string | null;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

const PROMO_PREFIX = "__PROMO_META__:";

/**
 * Parses promotion metadata safely from database row.
 * Embeds advanced rule parameters (quantity, bundle, threshold) inside the description
 * string so that it is 100% compliant with PostgreSQL check constraints on `sales`.
 */
export function parsePromotionRule(row: {
  id: string;
  title: string;
  description?: string | null;
  percent_off?: number | null;
  flat_price?: number | null;
  sale_type?: string | null;
  product_ids?: string[] | null;
  badge_label?: string | null;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}): PromotionRule {
  const rawDesc = row.description ?? "";
  let promoType: PromotionType = row.sale_type === "flat" ? "flat" : "percent";
  let minQuantity: number | null = null;
  let minSpend: number | null = null;
  let bundleProductIds: string[] = [];
  let discountAmount: number | null = null;
  let userDescription = rawDesc;

  if (rawDesc.includes(PROMO_PREFIX)) {
    try {
      const parts = rawDesc.split(PROMO_PREFIX);
      userDescription = parts[0].trim();
      const meta = JSON.parse(parts[1]);
      if (meta.promoType) promoType = meta.promoType;
      if (typeof meta.minQuantity === "number") minQuantity = meta.minQuantity;
      if (typeof meta.minSpend === "number") minSpend = meta.minSpend;
      if (Array.isArray(meta.bundleProductIds)) bundleProductIds = meta.bundleProductIds;
      if (typeof meta.discountAmount === "number") discountAmount = meta.discountAmount;
    } catch {
      // Best effort fallback to standard
    }
  }

  return {
    id: row.id,
    title: row.title,
    description: userDescription,
    promoType,
    percentOff: row.percent_off,
    flatPrice: row.flat_price,
    discountAmount,
    minQuantity,
    minSpend,
    bundleProductIds,
    productIds: row.product_ids ?? [],
    badgeLabel: row.badge_label,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

/**
 * Serializes promotion rule for storage in database.
 * Sets `sale_type` to "percent" or "flat" to strictly satisfy `sales_type_check`.
 */
export function serializePromotionForDb(rule: PromotionRule): {
  id?: string;
  title: string;
  description: string;
  sale_type: "percent" | "flat";
  percent_off: number | null;
  flat_price: number | null;
  product_ids: string[];
  badge_label: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
} {
  const meta = {
    promoType: rule.promoType,
    minQuantity: rule.minQuantity ?? null,
    minSpend: rule.minSpend ?? null,
    bundleProductIds: rule.bundleProductIds ?? [],
    discountAmount: rule.discountAmount ?? null,
  };

  const combinedDescription = `${(rule.description || "").trim()} ${PROMO_PREFIX}${JSON.stringify(meta)}`;

  let dbSaleType: "percent" | "flat" = "percent";
  if (rule.promoType === "flat" || (rule.promoType === "bundle" && rule.flatPrice !== null)) {
    dbSaleType = "flat";
  }

  return {
    ...(rule.id ? { id: rule.id } : {}),
    title: rule.title.trim(),
    description: combinedDescription,
    sale_type: dbSaleType,
    percent_off: rule.percentOff ?? (rule.promoType === "percent" ? 20 : null),
    flat_price: rule.flatPrice ?? null,
    product_ids: rule.productIds ?? [],
    badge_label: rule.badgeLabel ?? null,
    active: rule.active,
    starts_at: rule.startsAt ?? null,
    ends_at: rule.endsAt ?? null,
  };
}

export type CartItem = {
  id: string;
  slug: string;
  title: string;
  price: number;
  originalPrice: number;
  isFree: boolean;
  cover?: string;
  downloadLink?: string | null;
  category?: string;
  quantity?: number;
};

export type AppliedDiscount = {
  id: string;
  title: string;
  type: PromotionType | "coupon";
  amount: number;
  badge?: string;
};

export type CartCalculation = {
  subtotal: number;
  discounts: AppliedDiscount[];
  totalDiscount: number;
  payableTotal: number;
  savingsTotal: number;
  appliedPromotions: PromotionRule[];
};

/** Checks if a promotion is live according to current time */
export function isPromotionLive(rule: PromotionRule, now = Date.now()): boolean {
  if (!rule.active) return false;
  if (rule.startsAt && new Date(rule.startsAt).getTime() > now) return false;
  if (rule.endsAt && new Date(rule.endsAt).getTime() < now) return false;
  return true;
}

/**
 * Calculates cart discounts accurately:
 * 1. Evaluates all active promotions (percent, flat, quantity tiers, bundles, spend thresholds).
 * 2. Applies coupons if valid.
 * 3. Never allows payable total to drop below 0.
 */
export function calculateCartDiscounts(
  items: CartItem[],
  promotions: PromotionRule[],
  coupon?: { code: string; percent_off: number } | null,
): CartCalculation {
  const activeItems = items.filter((item) => !item.isFree);
  const rawSubtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const discounts: AppliedDiscount[] = [];
  const appliedPromotions: PromotionRule[] = [];

  if (activeItems.length === 0) {
    return {
      subtotal: rawSubtotal,
      discounts: [],
      totalDiscount: 0,
      payableTotal: rawSubtotal,
      savingsTotal: 0,
      appliedPromotions: [],
    };
  }

  const livePromos = promotions.filter((p) => isPromotionLive(p));

  // 1. Quantity-based Discounts (e.g. 2 or more items get 20% off)
  const quantityPromos = livePromos.filter(
    (p) => p.promoType === "quantity" && (p.minQuantity ?? 2) <= activeItems.length,
  );
  if (quantityPromos.length > 0) {
    const best = quantityPromos.sort(
      (a, b) => (b.percentOff || b.discountAmount || 0) - (a.percentOff || a.discountAmount || 0),
    )[0];
    let discount = 0;
    if (best.percentOff) {
      discount = Math.round((rawSubtotal * best.percentOff) / 100);
    } else if (best.discountAmount) {
      discount = best.discountAmount;
    }
    if (discount > 0) {
      discounts.push({
        id: best.id || "promo_quantity",
        title: best.title || `Buy ${best.minQuantity}+ Discount`,
        type: "quantity",
        amount: Math.min(discount, rawSubtotal),
        badge: best.badgeLabel || `${best.percentOff}% OFF`,
      });
      appliedPromotions.push(best);
    }
  }

  // 2. Bundle Deals (buying 3 specific products together)
  const bundlePromos = livePromos.filter(
    (p) => p.promoType === "bundle" && p.bundleProductIds && p.bundleProductIds.length > 0,
  );
  for (const bundle of bundlePromos) {
    const required = new Set(bundle.bundleProductIds || []);
    const matchingItems = items.filter((item) => required.has(item.id));
    if (matchingItems.length === required.size && required.size > 0) {
      const bundleRegularSum = matchingItems.reduce((sum, i) => sum + i.price, 0);
      let bundleDiscount = 0;
      if (bundle.flatPrice !== null && bundle.flatPrice !== undefined) {
        bundleDiscount = Math.max(0, bundleRegularSum - bundle.flatPrice);
      } else if (bundle.percentOff) {
        bundleDiscount = Math.round((bundleRegularSum * bundle.percentOff) / 100);
      } else if (bundle.discountAmount) {
        bundleDiscount = bundle.discountAmount;
      }
      if (bundleDiscount > 0) {
        discounts.push({
          id: bundle.id || "promo_bundle",
          title: bundle.title || "Bundle Deal Savings",
          type: "bundle",
          amount: bundleDiscount,
          badge: bundle.badgeLabel || "BUNDLE DEAL",
        });
        appliedPromotions.push(bundle);
      }
    }
  }

  // 3. Order Value Threshold Offers (e.g. spend ₹1,000+ get ₹200 off)
  const thresholdPromos = livePromos.filter(
    (p) => p.promoType === "threshold" && p.minSpend && rawSubtotal >= p.minSpend,
  );
  if (thresholdPromos.length > 0) {
    const best = thresholdPromos.sort(
      (a, b) => (b.percentOff || b.discountAmount || 0) - (a.percentOff || a.discountAmount || 0),
    )[0];
    let discount = 0;
    if (best.percentOff) {
      discount = Math.round((rawSubtotal * best.percentOff) / 100);
    } else if (best.discountAmount) {
      discount = best.discountAmount;
    }
    if (discount > 0) {
      discounts.push({
        id: best.id || "promo_threshold",
        title: best.title || `Orders over ₹${best.minSpend} Offer`,
        type: "threshold",
        amount: Math.min(discount, rawSubtotal),
        badge: best.badgeLabel || "TIER DISCOUNT",
      });
      appliedPromotions.push(best);
    }
  }

  // Calculate current subtotal after promotions
  const promoDiscountSum = discounts.reduce((sum, d) => sum + d.amount, 0);
  const afterPromos = Math.max(0, rawSubtotal - promoDiscountSum);

  // 4. Coupon Code Integration
  if (coupon && coupon.percent_off > 0 && afterPromos > 0) {
    const couponDiscount = Math.round((afterPromos * coupon.percent_off) / 100);
    discounts.push({
      id: `coupon_${coupon.code}`,
      title: `Coupon (${coupon.code.toUpperCase()})`,
      type: "coupon",
      amount: couponDiscount,
      badge: `${coupon.percent_off}% OFF`,
    });
  }

  const totalDiscount = Math.min(
    rawSubtotal,
    discounts.reduce((sum, d) => sum + d.amount, 0),
  );
  const payableTotal = Math.max(0, rawSubtotal - totalDiscount);

  const originalSavings = items.reduce(
    (sum, item) => sum + Math.max(0, (item.originalPrice || item.price) - item.price),
    0,
  );
  const savingsTotal = originalSavings + totalDiscount;

  return {
    subtotal: rawSubtotal,
    discounts,
    totalDiscount,
    payableTotal,
    savingsTotal,
    appliedPromotions,
  };
}
