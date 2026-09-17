import { adminClient, requireUser } from "./supabase.server";
import { sendReceiptEmail } from "./receipt.server";
import {
  broadcastCollaboratorRealtimeEvent,
  intelligentResolveCollaborator,
} from "./collaborator.engine.server";

const CASHFREE_MODE: "production" | "sandbox" =
  (process.env["CASHFREE_MODE"] ?? process.env["VITE_CASHFREE_MODE"]) === "sandbox"
    ? "sandbox"
    : "production";

const CF_BASE =
  CASHFREE_MODE === "sandbox"
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
    price: Number(product.price),
    is_free: Boolean(product.isFree),
    download_link: product.downloadLink ?? null,
  };
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

async function persistPendingOrder(input: {
  userId: string | null;
  product: ProductRow;
  cfOrderId: string;
  amount: number;
  couponCode?: string | undefined;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  origin: string;
  collaboratorLinkId: string | null;
}) {
  try {
    const { error } = await adminClient().from("orders").insert({
      user_id: input.userId,
      product_id: input.product.id,
      cf_order_id: input.cfOrderId,
      amount: input.amount,
      status: "PENDING",
      coupon_code: input.couponCode ?? null,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      download_link: input.product.download_link,
      origin: input.origin,
      collaborator_link_id: input.collaboratorLinkId,
    });
    if (error) {
      console.error("[Cashfree] Pending order persistence failed; checkout will continue:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Cashfree] Pending order persistence threw; checkout will continue:", error);
    return false;
  }
}

export async function createOrder(input: CreateOrderInput) {
  const product = await loadProduct(input.slug);
  if (product.is_free) throw new Error("This product is free — no payment needed");

  // catalog.loadProduct() already applies the currently active store sale.
  // Never apply the same sale a second time here.
  const amount = await applyCoupon(product.price, input.couponCode, product.id);
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
      order_meta: {
        return_url: `${input.origin}/payment/status?order_id=${cfOrderId}`,
      },
      order_note: product.title.slice(0, 200),
      order_tags: {
        product_id: product.id,
        product_slug: product.slug,
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
    throw new Error(`Cashfree ${CASHFREE_MODE} order creation failed: ${detail}`);
  }

  const persisted = await persistPendingOrder({
    userId: user?.id ?? null,
    product,
    cfOrderId,
    amount,
    couponCode: input.couponCode,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    origin: input.origin,
    collaboratorLinkId: collaborator?.id ?? null,
  });

  if (collaborator?.id) {
    broadcastCollaboratorRealtimeEvent("order_pending", {
      orderId: cfOrderId,
      linkId: collaborator.id,
      code: collaborator.code,
      amount,
      productId: product.id,
    });
  }

  return {
    orderId: cfOrderId,
    paymentSessionId: payload.payment_session_id,
    amount,
    cashfreeMode: CASHFREE_MODE,
    orderPersisted: persisted,
  };
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
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("cf_order_id", cfOrderId)
      .maybeSingle();

    if (error) {
      console.warn(`[Cashfree] loadOrder query issue for ${cfOrderId}:`, error.message);
      return null;
    }
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
        // Best effort only.
      }
    }

    if (row.products && !row.products.download_link && row.download_link) {
      row.products.download_link = row.download_link;
    }

    // Direct fallback from products table if link is still missing
    if ((!row.products || !row.products.download_link) && row.product_id) {
      try {
        const { data: directProd } = await adminClient()
          .from("products")
          .select("id, slug, title, download_link")
          .eq("id", row.product_id)
          .maybeSingle();
        if (directProd?.download_link) {
          row.download_link = directProd.download_link;
          row.products = {
            id: directProd.id,
            slug: directProd.slug,
            title: directProd.title,
            download_link: directProd.download_link,
          };
        }
      } catch {}
    }

    return row;
  } catch (err) {
    console.error(`[Cashfree] loadOrder unexpected exception for ${cfOrderId}:`, err);
    return null;
  }
}

type CashfreeOrderPayload = {
  order_status?: string;
  order_amount?: number;
  created_at?: string;
  message?: string;
  order_tags?: Record<string, string | undefined>;
  order_meta?: { return_url?: string };
  customer_details?: {
    customer_id?: string;
    customer_email?: string;
    customer_phone?: string;
    customer_name?: string;
  };
};

async function fetchCashfreeOrder(cfOrderId: string): Promise<CashfreeOrderPayload> {
  const response = await fetch(`${CF_BASE}/orders/${cfOrderId}`, { headers: cfHeaders() });
  const payload = (await response.json()) as CashfreeOrderPayload;
  if (!response.ok) {
    throw new Error(payload.message ?? `Could not fetch Cashfree order (${response.status})`);
  }
  return payload;
}

export type CashfreePaymentItem = {
  payment_status?: string;
  payment_amount?: number;
  payment_completion_time?: string;
  payment_time?: string;
  payment_currency?: string;
  payment_message?: string;
};

async function fetchCashfreePayments(cfOrderId: string): Promise<CashfreePaymentItem[]> {
  try {
    const response = await fetch(`${CF_BASE}/orders/${cfOrderId}/payments`, { headers: cfHeaders() });
    if (!response.ok) return [];
    return (await response.json()) as CashfreePaymentItem[];
  } catch {
    return [];
  }
}

async function recoverOrderFromCashfree(
  cfOrderId: string,
  payload: CashfreeOrderPayload,
): Promise<SettleRow | null> {
  const tags = payload.order_tags ?? {};
  let productId = tags.product_id || null;
  let productSlug = tags.product_slug || "";
  const orderNote = (payload.order_note || "").trim();
  const origin =
    tags.origin ||
    (() => {
      try {
        return payload.order_meta?.return_url
          ? new URL(payload.order_meta.return_url).origin
          : null;
      } catch {
        return null;
      }
    })();
  const customer = payload.customer_details ?? {};
  const userId = tags.user_id || customer.customer_id || null;
  const collaboratorLinkId = tags.collaborator_link_id || null;

  let product: ProductRow | null = null;
  try {
    const { loadProduct: fetchCatalogProduct } = await import("./catalog.server");
    const target = productId || productSlug || orderNote;
    if (target) {
      const p = await fetchCatalogProduct(target);
      if (p) {
        product = {
          id: p.id ?? p.slug,
          slug: p.slug,
          title: p.title,
          price: Number(p.price),
          is_free: Boolean(p.isFree),
          download_link: p.downloadLink ?? null,
        };
        productId = product.id;
        productSlug = product.slug;
      }
    }
  } catch (err) {
    console.warn("[Cashfree] recoverOrderFromCashfree loadProduct warning:", err);
  }

  // Direct database lookup if product or download link is still missing
  if ((!product || !product.download_link) && (productId || productSlug)) {
    try {
      const db = adminClient();
      let query = db.from("products").select("id, slug, title, price, is_free, download_link");
      if (productId) query = query.eq("id", productId);
      else query = query.eq("slug", productSlug);
      const { data: dbProd } = await query.maybeSingle();
      if (dbProd) {
        product = {
          id: dbProd.id,
          slug: dbProd.slug,
          title: dbProd.title,
          price: Number(dbProd.price),
          is_free: Boolean(dbProd.is_free),
          download_link: dbProd.download_link,
        };
      }
    } catch {}
  }

  const status =
    payload.order_status === "PAID"
      ? "PAID"
      : payload.order_status === "ACTIVE"
        ? "PENDING"
        : "FAILED";

  const rowData = {
    user_id: userId,
    product_id: productId || product?.id || null,
    cf_order_id: cfOrderId,
    amount: Number(payload.order_amount ?? 0),
    status,
    coupon_code: tags.coupon_code || null,
    customer_email: customer.customer_email || null,
    customer_name: customer.customer_name || null,
    customer_phone: customer.customer_phone || null,
    download_link: product?.download_link ?? null,
    origin,
    collaborator_link_id: collaboratorLinkId || null,
    paid_at: status === "PAID" ? new Date().toISOString() : null,
  };

  try {
    await adminClient().from("orders").upsert(rowData, { onConflict: "cf_order_id" });
  } catch (upsertError) {
    console.error(
      `[Cashfree] Upsert failed during recoverOrderFromCashfree for ${cfOrderId}:`,
      upsertError,
    );
  }

  const reloaded = await loadOrder(cfOrderId);
  if (reloaded) return reloaded;

  return {
    id: cfOrderId,
    status,
    amount: rowData.amount,
    user_id: userId,
    product_id: rowData.product_id,
    download_link: rowData.download_link,
    collaborator_link_id: collaboratorLinkId,
    coupon_code: rowData.coupon_code,
    customer_email: rowData.customer_email,
    customer_phone: rowData.customer_phone,
    customer_name: rowData.customer_name,
    origin,
    receipt_sent_at: null,
    products: product
      ? {
          id: product.id,
          slug: product.slug,
          title: product.title,
          download_link: product.download_link,
        }
      : null,
  };
}

const PAID_STATUSES = ["PAID", "SUCCESS", "COMPLETED", "CAPTURED", "FREE"] as const;

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
      // Best effort only.
    }
  }

  // Direct DB check for download link if still null
  if (!link && row.product_id) {
    try {
      const { data: dbProd } = await adminClient()
        .from("products")
        .select("download_link, title, slug")
        .eq("id", row.product_id)
        .maybeSingle();
      if (dbProd?.download_link) {
        link = dbProd.download_link;
        if (row.products) {
          row.products.download_link = link;
          if (!row.products.title) row.products.title = dbProd.title;
          if (!row.products.slug) row.products.slug = dbProd.slug;
        }
      }
    } catch {}
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
    if (updateError) {
      console.warn(`[Cashfree] Could not update order settlement: ${updateError.message}`);
    }

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

  await syncProductSalesCounter(row.product_id ?? row.products?.id).catch(() => {});

  if (!alreadyPaid) {
    try {
      broadcastCollaboratorRealtimeEvent("order_paid", {
        orderId: cfOrderId,
        linkId: resolvedLinkId,
        amount: Number(row.amount ?? 0),
        productId: row.products?.id ?? row.product_id,
      });
    } catch {}
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
      row.receipt_sent_at = new Date().toISOString();
      try {
        await db
          .from("orders")
          .update({ receipt_sent_at: row.receipt_sent_at })
          .eq("id", row.id);
      } catch (err) {
        console.warn("[Cashfree] Could not update receipt_sent_at in DB:", err);
      }
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
  const payload = await fetchCashfreeOrder(cfOrderId);
  let paid = payload.order_status === "PAID";
  let transactionTime = payload.created_at || new Date().toISOString();

  // If order_status is not yet PAID, inspect payments directly for SUCCESS
  if (!paid) {
    const payments = await fetchCashfreePayments(cfOrderId);
    const successPayment = payments.find((p) => p.payment_status === "SUCCESS");
    if (successPayment) {
      paid = true;
      if (successPayment.payment_completion_time || successPayment.payment_time) {
        transactionTime = (successPayment.payment_completion_time || successPayment.payment_time)!;
      }
    }
  }

  let row = await loadOrder(cfOrderId);
  if (!row) row = await recoverOrderFromCashfree(cfOrderId, payload);
  if (row?.status === "PAID") {
    paid = true;
  }

  const status: VerifiedOrder["status"] = paid
    ? "PAID"
    : payload.order_status === "ACTIVE"
      ? "PENDING"
      : "FAILED";

  const link = row && paid ? await settlePaidOrder(cfOrderId, row) : null;

  const finalDownloadLink =
    link ||
    row?.download_link ||
    row?.products?.download_link ||
    (row?.origin ? `${row.origin}/product/${row?.products?.slug ?? ""}` : null);

  const customerEmail = row?.customer_email ?? payload.customer_details?.customer_email ?? null;
  const customerPhone = row?.customer_phone ?? payload.customer_details?.customer_phone ?? null;
  const customerName = row?.customer_name ?? payload.customer_details?.customer_name ?? null;

  return {
    status,
    amount: Number(payload.order_amount ?? row?.amount ?? 0),
    productTitle: row?.products?.title ?? (payload.order_note || "Editly Store purchase"),
    productSlug: row?.products?.slug ?? (payload.order_tags?.product_slug || ""),
    downloadLink: paid ? finalDownloadLink : null,
    email: customerEmail,
    phone: customerPhone,
    customerName: customerName,
    receiptSent: paid ? Boolean(row?.receipt_sent_at) : false,
    paidAt: row?.paid_at || transactionTime,
  };
}

export async function resendOrderReceipt(
  cfOrderId: string,
  overrideEmail?: string,
): Promise<{ success: boolean; message: string }> {
  const verified = await verifyOrder(cfOrderId);
  if (verified.status !== "PAID") {
    return { success: false, message: "Order is not paid" };
  }
  const emailTo = (overrideEmail || verified.email || "").trim();
  if (!emailTo || !emailTo.includes("@")) {
    return { success: false, message: "No valid email address found for this order" };
  }

  const sent = await sendReceiptEmail({
    toEmail: emailTo,
    customerName: verified.customerName || emailTo.split("@")[0] || "Valued Customer",
    customerPhone: verified.phone || "",
    productName: verified.productTitle,
    amount: verified.amount,
    orderId: cfOrderId,
    downloadLink: verified.downloadLink || "",
    storeName: "Editly Store",
  });

  if (sent) {
    try {
      await adminClient()
        .from("orders")
        .update({ receipt_sent_at: new Date().toISOString(), customer_email: emailTo })
        .eq("cf_order_id", cfOrderId);
    } catch {}
    return { success: true, message: `Receipt sent to ${emailTo}` };
  }
  return { success: false, message: "Email delivery failed via EmailJS" };
}

export async function claimFree(
  slug: string,
  accessToken: string | undefined,
  collaboratorCode?: string,
  clientUserEmail?: string,
  clientUserName?: string,
) {
  const user = await requireUser(accessToken);
  const product = await loadProduct(slug);
  if (!product.is_free) throw new Error("This product is not free");

  // Determine user email and name reliably
  let customerEmail = (user.email || clientUserEmail || "").trim();
  let customerName = (clientUserName || customerEmail.split("@")[0] || "Valued Customer").trim();

  try {
    const { data: profile } = await adminClient()
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.email && !customerEmail) customerEmail = profile.email.trim();
    if (profile?.full_name?.trim()) customerName = profile.full_name.trim();
  } catch (err) {
    console.warn("[Cashfree] Could not fetch user profile for claimFree:", err);
  }

  // Guarantee direct download link from catalog or DB
  let downloadLink = product.download_link;
  if (!downloadLink && product.id) {
    try {
      const { data: directProd } = await adminClient()
        .from("products")
        .select("download_link, title")
        .eq("id", product.id)
        .maybeSingle();
      if (directProd?.download_link) downloadLink = directProd.download_link;
    } catch {}
  }

  const collaborator = await intelligentResolveCollaborator({
    collaboratorCode,
    userId: user.id,
    customerEmail: customerEmail || user.email,
  });
  const cfOrderId = `free_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { error: orderError } = await adminClient().from("orders").insert({
    user_id: user.id,
    product_id: product.id,
    cf_order_id: cfOrderId,
    amount: 0,
    status: "PAID",
    customer_email: customerEmail || user.email || null,
    customer_name: customerName,
    download_link: downloadLink,
    paid_at: new Date().toISOString(),
    collaborator_link_id: collaborator?.id ?? null,
  });
  if (orderError) throw new Error(`Could not record free order: ${orderError.message}`);

  await syncProductSalesCounter(product.id).catch(() => {});

  if (collaborator?.id) {
    try {
      broadcastCollaboratorRealtimeEvent("order_paid", {
        orderId: cfOrderId,
        linkId: collaborator.id,
        code: collaborator.code,
        amount: 0,
        productId: product.id,
      });
    } catch {}
  }

  // Explicitly await EmailJS receipt sending before completing serverless function
  let receiptSent = false;
  const emailToDeliver = customerEmail || user.email;
  if (emailToDeliver && emailToDeliver.includes("@")) {
    try {
      receiptSent = await sendReceiptEmail({
        toEmail: emailToDeliver,
        customerName,
        customerPhone: "",
        productName: product.title,
        amount: 0,
        orderId: cfOrderId,
        downloadLink: downloadLink ?? "",
        storeName: "Editly Store",
      });

      if (receiptSent) {
        try {
          await adminClient()
            .from("orders")
            .update({ receipt_sent_at: new Date().toISOString() })
            .eq("cf_order_id", cfOrderId);
        } catch (dbErr) {
          console.warn("[Cashfree] Could not update receipt_sent_at for free order:", dbErr);
        }
      }
    } catch (emailErr) {
      console.error("[Cashfree] claimFree sendReceiptEmail failed:", emailErr);
    }
  } else {
    console.warn("[Cashfree] No valid email address found to send free product receipt.");
  }

  return {
    orderId: cfOrderId,
    downloadLink,
    productTitle: product.title,
    receiptSent,
    email: emailToDeliver || null,
    customerName,
  };
}

export async function finalizeOrder(cfOrderId: string, status: "PAID" | "FAILED") {
  let row = await loadOrder(cfOrderId);
  if (!row) {
    try {
      row = await recoverOrderFromCashfree(cfOrderId, await fetchCashfreeOrder(cfOrderId));
    } catch {
      row = null;
    }
  }
  if (!row) return;
  if (status === "PAID") {
    await settlePaidOrder(cfOrderId, row);
    return;
  }
  if (row.status === "PAID") return;
  const { error } = await adminClient().from("orders").update({ status: "FAILED" }).eq("id", row.id);
  if (error) throw new Error(`Could not mark order failed: ${error.message}`);
}
