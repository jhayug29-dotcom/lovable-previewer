import { adminClient, requireUser } from "./supabase.server";
import { sendReceiptEmail } from "./receipt.server";
import {
  broadcastCollaboratorRealtimeEvent,
  intelligentResolveCollaborator,
} from "./collaborator.engine.server";

const CF_BASE =
  process.env["CASHFREE_MODE"] === "sandbox"
    ? "https://sandbox.cashfree.com/pg"
    : "https://api.cashfree.com/pg";
const CF_VERSION = "2023-08-01";

function cfHeaders() {
  const appId = process.env["CASHFREE_APP_ID"];
  const secret = process.env["CASHFREE_SECRET_KEY"];
  if (!appId || !secret) throw new Error("Cashfree keys are not configured");
  return {
    "Content-Type": "application/json",
    "x-api-version": CF_VERSION,
    "x-client-id": appId,
    "x-client-secret": secret,
  };
}

export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  price: number;
  is_free: boolean;
  download_link: string | null;
};

async function loadProduct(slug: string): Promise<ProductRow> {
  const { loadProduct: fetchCatalogProduct } = await import("./catalog.server");
  const product = await fetchCatalogProduct(slug);
  if (!product) throw new Error("Product unavailable. Please refresh and try again.");
  return {
    id: product.id ?? product.slug,
    slug: product.slug,
    title: product.title,
    price: product.price,
    is_free: Boolean(product.isFree),
    download_link: product.downloadLink ?? null,
  };
}

async function applySalePricing(productId: string, price: number): Promise<number> {
  try {
    const { loadPromos } = await import("./catalog.server");
    const { sale } = await loadPromos();
    if (!sale) return price;
    const ids = sale.product_ids ?? [];
    if (ids.length > 0 && !ids.includes(productId)) return price;
    const next =
      sale.sale_type === "flat" && sale.flat_price !== null
        ? Math.round(sale.flat_price)
        : sale.percent_off
          ? Math.round(price * (1 - sale.percent_off / 100))
          : price;
    return next > 0 && next < price ? next : price;
  } catch {
    return price;
  }
}

async function applyCoupon(
  amount: number,
  code: string | undefined,
  productId?: string,
): Promise<number> {
  if (!code) return amount;
  const { data } = await adminClient()
    .from("coupons")
    .select("*")
    .ilike("code", code.trim())
    .eq("active", true)
    .maybeSingle();
  const coupon = data as {
    percent_off: number;
    expires_at: string | null;
    max_uses: number | null;
    used_count: number;
    product_ids?: string[] | null;
  } | null;
  if (!coupon) return amount;
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return amount;
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return amount;
  const scoped = coupon.product_ids ?? [];
  if (scoped.length > 0 && (!productId || !scoped.includes(productId))) return amount;
  return Math.max(1, Math.round(amount * (1 - coupon.percent_off / 100)));
}

export type CreateOrderInput = {
  slug: string;
  origin: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  couponCode?: string | undefined;
  accessToken?: string | undefined;
  collaboratorCode?: string | undefined;
};

export async function createOrder(input: CreateOrderInput) {
  const product = await loadProduct(input.slug);
  if (product.is_free) throw new Error("This product is free — no payment needed");

  const salePrice = await applySalePricing(product.id, Number(product.price));
  const amount = await applyCoupon(salePrice, input.couponCode, product.id);
  const cfOrderId = `editly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = input.accessToken ? await requireUser(input.accessToken).catch(() => null) : null;
  const collaborator = await intelligentResolveCollaborator({
    collaboratorCode: input.collaboratorCode,
    userId: user?.id,
    customerEmail: input.customerEmail,
  });

  const response = await fetch(`${CF_BASE}/orders`, {
    method: "POST",
    headers: cfHeaders(),
    body: JSON.stringify({
      order_id: cfOrderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user?.id ?? `guest_${Date.now()}`,
        customer_name: input.customerName.slice(0, 100),
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone.replace(/\D/g, "").slice(-10).padStart(10, "0"),
      },
      order_meta: { return_url: `${input.origin}/payment/status?order_id=${cfOrderId}` },
      order_note: product.title.slice(0, 50),
    }),
  });

  const payload = (await response.json()) as { payment_session_id?: string; message?: string };
  if (!response.ok || !payload.payment_session_id) {
    throw new Error(
      payload.message ?? "Could not start the payment (Cashfree rejected order creation)",
    );
  }

  const { error: orderInsertError } = await adminClient()
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      product_id: product.id,
      cf_order_id: cfOrderId,
      amount,
      status: "PENDING",
      coupon_code: input.couponCode ?? null,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      download_link: product.download_link,
      origin: input.origin,
      collaborator_link_id: collaborator?.id ?? null,
    });

  if (orderInsertError) throw new Error(`Could not record order: ${orderInsertError.message}`);

  if (collaborator?.id) {
    broadcastCollaboratorRealtimeEvent("order_pending", {
      orderId: cfOrderId,
      linkId: collaborator.id,
      code: collaborator.code,
      amount,
      productId: product.id,
    });
  }

  return { orderId: cfOrderId, paymentSessionId: payload.payment_session_id, amount };
}

type SettleRow = {
  id: string;
  status: string;
  amount: number;
  user_id?: string | null;
  product_id?: string | null;
  download_link?: string | null;
  collaborator_link_id?: string | null;
  coupon_code: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  origin: string | null;
  receipt_sent_at: string | null;
  products: { id?: string; slug: string; title: string; download_link: string | null } | null;
};

const ORDER_COLUMNS =
  "id, status, amount, user_id, product_id, download_link, collaborator_link_id, coupon_code, customer_email, customer_phone, customer_name, origin, receipt_sent_at, products(*)";

async function loadOrder(cfOrderId: string): Promise<SettleRow | null> {
  const db = adminClient();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("cf_order_id", cfOrderId)
    .maybeSingle();

  if (error) throw new Error(`Could not load order ${cfOrderId}: ${error.message}`);
  if (!data) return null;
  const row = data as SettleRow;

  if ((!row.products || !row.products.download_link) && row.product_id) {
    try {
      const { loadProduct: fetchCatalogProduct } = await import("./catalog.server");
      const prod = await fetchCatalogProduct(row.product_id);
      if (prod) {
        row.products = {
          id: prod.id,
          slug: prod.slug,
          title: prod.title,
          download_link: prod.downloadLink ?? row.download_link ?? null,
        };
      }
    } catch {
      // Product metadata fallback is best effort.
    }
  }

  if (row.products && !row.products.download_link && row.download_link) {
    row.products.download_link = row.download_link;
  }

  return row;
}

const PAID_STATUSES = ["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"] as const;

/** Keep the denormalized products.sales counter aligned with the authoritative orders table. */
async function syncProductSalesCounter(productId: string | null | undefined) {
  if (!productId) return;
  const db = adminClient();
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("product_id", productId)
    .in("status", [...PAID_STATUSES]);
  if (error) throw new Error(`Could not sync product sales: ${error.message}`);

  const sales = data?.length ?? 0;
  const { error: updateError } = await db.from("products").update({ sales }).eq("id", productId);
  if (updateError) throw new Error(`Could not update product sales: ${updateError.message}`);
}

async function settlePaidOrder(cfOrderId: string, row: SettleRow): Promise<string | null> {
  const db = adminClient();
  let link = row.products?.download_link ?? row.download_link ?? null;

  if (!link && (row.product_id || row.products?.slug)) {
    try {
      const { loadProduct: fetchCatalogProduct } = await import("./catalog.server");
      const prod = await fetchCatalogProduct(row.product_id || row.products?.slug || "");
      if (prod?.downloadLink) {
        link = prod.downloadLink;
        if (row.products) row.products.download_link = link;
      }
    } catch {
      // Best effort only; the payment should still be settled.
    }
  }

  let resolvedLinkId = row.collaborator_link_id;
  if (!resolvedLinkId) {
    const deduced = await intelligentResolveCollaborator({
      userId: row.user_id,
      customerEmail: row.customer_email,
    });
    if (deduced?.id) resolvedLinkId = deduced.id;
  }

  const alreadyPaid = row.status === "PAID";
  if (!alreadyPaid || !row.receipt_sent_at) {
    const updatePayload: Record<string, unknown> = {
      status: "PAID",
      download_link: link,
      paid_at: new Date().toISOString(),
    };
    if (resolvedLinkId) updatePayload.collaborator_link_id = resolvedLinkId;

    const { error: updateError } = await db
      .from("orders")
      .update(updatePayload)
      .eq("id", row.id);
    if (updateError) throw new Error(`Could not settle order: ${updateError.message}`);

    if (row.coupon_code) {
      const { data: coupon, error: couponError } = await db
        .from("coupons")
        .select("id, used_count")
        .ilike("code", row.coupon_code.trim())
        .maybeSingle();
      if (!couponError && coupon) {
        await db
          .from("coupons")
          .update({ used_count: (coupon.used_count ?? 0) + 1 })
          .eq("id", coupon.id);
      }
    }
  }

  // Always reconcile the denormalized counter. This makes admin analytics reflect a
  // payment immediately, even when the buyer reaches the payment/status page before
  // a webhook arrives.
  await syncProductSalesCounter(row.product_id ?? row.products?.id);

  if (!alreadyPaid) {
    broadcastCollaboratorRealtimeEvent("order_paid", {
      orderId: cfOrderId,
      linkId: resolvedLinkId,
      amount: Number(row.amount ?? 0),
      productId: row.products?.id ?? row.product_id,
    });
  }

  if (!row.receipt_sent_at && row.customer_email) {
    const fallback = row.origin ? `${row.origin}/product/${row.products?.slug ?? ""}` : "";
    const sent = await sendReceiptEmail({
      toEmail: row.customer_email,
      customerName:
        row.customer_name?.trim() || row.customer_email.split("@")[0] || "Valued Customer",
      customerPhone: row.customer_phone?.trim() || "",
      productName: row.products?.title ?? "Editly Store purchase",
      amount: Number(row.amount ?? 0),
      orderId: cfOrderId,
      downloadLink: link ?? fallback,
      storeName: "Editly Store",
    });
    if (sent) {
      await db
        .from("orders")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return link;
}

export type VerifiedOrder = {
  status: "PAID" | "PENDING" | "FAILED";
  amount: number;
  productTitle: string;
  productSlug: string;
  downloadLink: string | null;
  email: string | null;
  phone: string | null;
  customerName: string | null;
  receiptSent: boolean;
  paidAt: string;
};

export async function verifyOrder(cfOrderId: string): Promise<VerifiedOrder> {
  const response = await fetch(`${CF_BASE}/orders/${cfOrderId}`, { headers: cfHeaders() });
  const payload = (await response.json()) as {
    order_status?: string;
    order_amount?: number;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message ?? "Could not verify the payment");
  const paid = payload.order_status === "PAID";
  const status: VerifiedOrder["status"] = paid
    ? "PAID"
    : payload.order_status === "ACTIVE"
      ? "PENDING"
      : "FAILED";
  const row = await loadOrder(cfOrderId);
  const link = row && paid ? await settlePaidOrder(cfOrderId, row) : null;
  return {
    status,
    amount: Number(payload.order_amount ?? row?.amount ?? 0),
    productTitle: row?.products?.title ?? "Editly Store purchase",
    productSlug: row?.products?.slug ?? "",
    downloadLink: paid
      ? link ||
        row?.download_link ||
        (row?.origin ? `${row.origin}/product/${row?.products?.slug ?? ""}` : null)
      : null,
    email: row?.customer_email ?? null,
    phone: row?.customer_phone ?? null,
    customerName: row?.customer_name ?? null,
    receiptSent: paid ? Boolean(row?.receipt_sent_at) || Boolean(link) : false,
    paidAt: new Date().toISOString(),
  };
}

export async function claimFree(
  slug: string,
  accessToken: string | undefined,
  collaboratorCode?: string,
) {
  const user = await requireUser(accessToken);
  const product = await loadProduct(slug);
  if (!product.is_free) throw new Error("This product is not free");
  const collaborator = await intelligentResolveCollaborator({
    collaboratorCode,
    userId: user.id,
    customerEmail: user.email,
  });

  const cfOrderId = `free_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { error: orderError } = await adminClient()
    .from("orders")
    .insert({
      user_id: user.id,
      product_id: product.id,
      cf_order_id: cfOrderId,
      amount: 0,
      status: "PAID",
      customer_email: user.email,
      download_link: product.download_link,
      paid_at: new Date().toISOString(),
      collaborator_link_id: collaborator?.id ?? null,
    });

  if (orderError) throw new Error(`Could not record free order: ${orderError.message}`);
  await syncProductSalesCounter(product.id);

  if (collaborator?.id) {
    broadcastCollaboratorRealtimeEvent("order_paid", {
      orderId: cfOrderId,
      linkId: collaborator.id,
      code: collaborator.code,
      amount: 0,
      productId: product.id,
    });
  }

  if (user.email) {
    void sendReceiptEmail({
      toEmail: user.email,
      customerName: user.email.split("@")[0] || "Valued Customer",
      customerPhone: "",
      productName: product.title,
      amount: 0,
      orderId: cfOrderId,
      downloadLink: product.download_link ?? "",
      storeName: "Editly Store",
    }).catch(() => false);
  }

  return { downloadLink: product.download_link, productTitle: product.title };
}

export async function finalizeOrder(cfOrderId: string, status: "PAID" | "FAILED") {
  const row = await loadOrder(cfOrderId);
  if (!row) return;
  if (status === "PAID") {
    await settlePaidOrder(cfOrderId, row);
    return;
  }
  if (row.status === "PAID") return;
  const { error } = await adminClient().from("orders").update({ status: "FAILED" }).eq("id", row.id);
  if (error) throw new Error(`Could not mark order failed: ${error.message}`);
}
