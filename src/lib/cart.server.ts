import { adminClient, requireUser } from "./supabase.server";
import { loadProduct } from "./catalog.server";
import { intelligentResolveCollaborator } from "./collaborator.engine.server";
import { calculateCartDiscounts, parsePromotionRule, type PromotionRule } from "./promotions";
import { sendReceiptEmail } from "./receipt.server";

const CF_APP_ID = process.env["CASHFREE_APP_ID"] ?? "";
const CF_SECRET = process.env["CASHFREE_SECRET_KEY"] ?? "";
const CASHFREE_MODE =
  (process.env["CASHFREE_MODE"] as "production" | "sandbox" | undefined) ?? "production";
const CF_BASE =
  CASHFREE_MODE === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
const CF_VERSION = "2023-08-01";

function cfHeaders(): Record<string, string> {
  const appId = CF_APP_ID.trim();
  const secret = CF_SECRET.trim();
  if (!appId || !secret) {
    throw new Error(
      `Cashfree credentials not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.`,
    );
  }
  return {
    "content-type": "application/json",
    "x-api-version": CF_VERSION,
    "x-client-id": appId,
    "x-client-secret": secret,
  };
}

export type CartCheckoutItem = {
  id: string;
  slug: string;
  title: string;
  price: number;
  originalPrice?: number;
  isFree?: boolean;
};

export type CreateCartOrderInput = {
  items: CartCheckoutItem[];
  origin: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  couponCode?: string;
  accessToken?: string;
  collaboratorCode?: string;
};

async function fetchLivePromotions(): Promise<PromotionRule[]> {
  const db = adminClient();
  const { data, error } = await db
    .from("sales")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r) => parsePromotionRule(r));
}

export async function createCartOrder(input: CreateCartOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot checkout an empty cart");
  }

  // Verify all products from database catalog
  const verifiedProducts = await Promise.all(
    input.items.map(async (item) => {
      const prod = await loadProduct(item.slug || item.id);
      return {
        id: prod.id,
        slug: prod.slug,
        title: prod.title,
        price: Number(prod.price) || 0,
        originalPrice: Number(prod.originalPrice) || Number(prod.price) || 0,
        isFree: Boolean(prod.isFree),
        downloadLink: prod.downloadLink ?? null,
      };
    }),
  );

  // If every product is free, redirect to free cart claim
  const allFree = verifiedProducts.every((p) => p.isFree || p.price === 0);
  if (allFree) {
    return claimFreeCart({
      items: verifiedProducts,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      accessToken: input.accessToken,
      collaboratorCode: input.collaboratorCode,
      origin: input.origin,
    });
  }

  // Load promotions & coupons to verify final payable total
  const promotions = await fetchLivePromotions();
  let couponData: { code: string; percent_off: number } | null = null;
  if (input.couponCode) {
    const { data: cRow } = await adminClient()
      .from("coupons")
      .select("code, percent_off, active, expires_at, max_uses, used_count")
      .ilike("code", input.couponCode.trim())
      .eq("active", true)
      .maybeSingle();
    if (cRow) {
      const notExpired = !cRow.expires_at || new Date(cRow.expires_at) > new Date();
      const withinLimit = cRow.max_uses === null || (cRow.used_count ?? 0) < cRow.max_uses;
      if (notExpired && withinLimit) {
        couponData = { code: cRow.code, percent_off: Number(cRow.percent_off) || 0 };
      }
    }
  }

  const calc = calculateCartDiscounts(verifiedProducts, promotions, couponData);
  const payableAmount = calc.payableTotal;

  if (payableAmount <= 0) {
    return claimFreeCart({
      items: verifiedProducts,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      accessToken: input.accessToken,
      collaboratorCode: input.collaboratorCode,
      origin: input.origin,
    });
  }

  const cfOrderId = `editly_cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const user = input.accessToken ? await requireUser(input.accessToken).catch(() => null) : null;
  const collaborator = await intelligentResolveCollaborator({
    collaboratorCode: input.collaboratorCode,
    userId: user?.id,
    customerEmail: input.customerEmail,
  });

  const orderNote = `Cart (${verifiedProducts.length} items): ${verifiedProducts.map((p) => p.title).join(", ")}`.slice(0, 200);

  // Create Cashfree payment order
  const response = await fetch(`${CF_BASE}/orders`, {
    method: "POST",
    headers: cfHeaders(),
    body: JSON.stringify({
      order_id: cfOrderId,
      order_amount: payableAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: user?.id ?? `guest_${Date.now()}`,
        customer_name: input.customerName.slice(0, 100),
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone.replace(/\D/g, "").slice(-10).padStart(10, "0"),
      },
      order_meta: {
        return_url: `${input.origin}/payment/status?order_id=${cfOrderId}`,
      },
      order_note: orderNote,
      order_tags: {
        cart_count: String(verifiedProducts.length),
        user_id: user?.id ?? "",
        collaborator_link_id: collaborator?.id ?? "",
        coupon_code: input.couponCode ?? "",
        origin: input.origin.slice(0, 200),
      },
    }),
  });

  const payload = (await response.json()) as {
    payment_session_id?: string;
    message?: string;
  };

  if (!response.ok || !payload.payment_session_id) {
    const detail = payload.message ?? `HTTP ${response.status}`;
    throw new Error(`Cashfree order creation failed: ${detail}`);
  }

  // Persist pending orders in DB for all items
  const db = adminClient();
  for (let i = 0; i < verifiedProducts.length; i++) {
    const prod = verifiedProducts[i];
    const itemCfOrderId = i === 0 ? cfOrderId : `${cfOrderId}_item_${i + 1}`;
    try {
      await db.from("orders").insert({
        user_id: user?.id ?? null,
        product_id: prod.id,
        cf_order_id: itemCfOrderId,
        amount: i === 0 ? payableAmount : prod.price,
        status: "PENDING",
        coupon_code: input.couponCode ?? null,
        customer_email: input.customerEmail,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        download_link: prod.downloadLink,
        origin: input.origin,
        collaborator_link_id: collaborator?.id ?? null,
      });
    } catch (insertErr) {
      console.warn(`[Cart] Pending order persistence warning for item ${prod.title}:`, insertErr);
    }
  }

  return {
    paymentSessionId: payload.payment_session_id,
    cashfreeMode: CASHFREE_MODE,
    orderId: cfOrderId,
    isFree: false,
  };
}

export type ClaimFreeCartInput = {
  items: CartCheckoutItem[];
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  accessToken?: string;
  collaboratorCode?: string;
  origin?: string;
};

export async function claimFreeCart(input: ClaimFreeCartInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error("No items in cart to claim");
  }

  const user = input.accessToken ? await requireUser(input.accessToken).catch(() => null) : null;
  const cfOrderId = `free_cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const collaborator = await intelligentResolveCollaborator({
    collaboratorCode: input.collaboratorCode,
    userId: user?.id,
    customerEmail: input.customerEmail,
  });

  const verifiedProducts = await Promise.all(
    input.items.map(async (item) => {
      const prod = await loadProduct(item.slug || item.id);
      return {
        id: prod.id,
        slug: prod.slug,
        title: prod.title,
        price: 0,
        downloadLink: prod.downloadLink ?? null,
      };
    }),
  );

  const db = adminClient();
  const nowIso = new Date().toISOString();

  // Persist all free orders
  for (let i = 0; i < verifiedProducts.length; i++) {
    const prod = verifiedProducts[i];
    const itemCfOrderId = i === 0 ? cfOrderId : `${cfOrderId}_item_${i + 1}`;
    try {
      await db.from("orders").insert({
        user_id: user?.id ?? null,
        product_id: prod.id,
        cf_order_id: itemCfOrderId,
        amount: 0,
        status: "PAID",
        customer_email: input.customerEmail,
        customer_name: input.customerName,
        customer_phone: input.customerPhone || null,
        download_link: prod.downloadLink,
        paid_at: nowIso,
        origin: input.origin || null,
        collaborator_link_id: collaborator?.id ?? null,
      });

      // Update product sales counter
      const { data: salesCount } = await db
        .from("orders")
        .select("id")
        .eq("product_id", prod.id)
        .in("status", ["PAID", "SUCCESS", "COMPLETED", "FREE"]);
      if (salesCount) {
        await db.from("products").update({ sales: salesCount.length }).eq("id", prod.id);
      }
    } catch (orderErr) {
      console.warn(`[Cart] Free order persistence warning for item ${prod.title}:`, orderErr);
    }
  }

  // Send consolidated EmailJS receipt
  const combinedTitles = verifiedProducts.map((p) => p.title).join(", ");
  const primaryDownload = verifiedProducts[0]?.downloadLink || (input.origin ? `${input.origin}/store` : "");

  let receiptSent = false;
  try {
    receiptSent = await sendReceiptEmail({
      toEmail: input.customerEmail,
      customerName: input.customerName || input.customerEmail.split("@")[0] || "Valued Customer",
      customerPhone: input.customerPhone || "",
      productName: combinedTitles,
      amount: 0,
      orderId: cfOrderId,
      downloadLink: primaryDownload,
      storeName: "Editly Store",
    });

    if (receiptSent) {
      await db
        .from("orders")
        .update({ receipt_sent_at: nowIso })
        .eq("cf_order_id", cfOrderId);
    }
  } catch (emailErr) {
    console.warn("[Cart] Consolidated free receipt email dispatch warning:", emailErr);
  }

  return {
    orderId: cfOrderId,
    isFree: true,
    receiptSent,
    items: verifiedProducts,
  };
}
