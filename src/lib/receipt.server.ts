/**
 * Server-side receipt delivery through the EmailJS REST API.
 * Runs from the webhook and from payment verification, so the buyer gets the
 * product link even if they close the browser right after paying.
 *
 * Requires (EmailJS dashboard → Account):
 *  - EMAILJS_PUBLIC_KEY  (User ID)
 *  - EMAILJS_PRIVATE_KEY (API key; enable "API requests from non-browser apps")
 */
const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

function cfg(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? process.env[`STORE_${name}`] ?? fallback;
}

export type ReceiptPayload = {
  toEmail: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  amount: number;
  orderId: string;
  downloadLink: string;
  storeName?: string;
};

export function isServerReceiptConfigured(): boolean {
  return Boolean(cfg("EMAILJS_PUBLIC_KEY") && cfg("EMAILJS_PRIVATE_KEY"));
}

/** Returns true when EmailJS accepted the message. Never throws. */
export async function sendReceiptEmail(payload: ReceiptPayload): Promise<boolean> {
  const publicKey = cfg("EMAILJS_PUBLIC_KEY");
  const privateKey = cfg("EMAILJS_PRIVATE_KEY");
  const serviceId = cfg("EMAILJS_SERVICE_ID", "service_tbk5flg")!;
  const templateId = cfg("EMAILJS_TEMPLATE_ID", "template_e8uqzpz")!;
  if (!publicKey || !privateKey) return false;

  const fallbackLink = (payload.downloadLink || "").trim();
  const formattedAmount = `₹${payload.amount.toLocaleString("en-IN")}`;
  const orderDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const storeName = payload.storeName || "Editly Store";
  const cleanPhone = (payload.customerPhone || "").trim();
  const cleanName =
    (payload.customerName || "").trim() || payload.toEmail.split("@")[0] || "Valued Customer";

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          // Store Name
          store_name: storeName,
          site_name: storeName,
          brand_name: storeName,
          company_name: storeName,
          from_name: storeName,
          storeName: storeName,
          siteName: storeName,
          "Editly Store": storeName,
          Editly: storeName,

          // Buyer / Customer Name
          customer_name: cleanName,
          buyer_name: cleanName,
          name: cleanName,
          to_name: cleanName,
          customerName: cleanName,
          buyerName: cleanName,
          user_name: cleanName,

          // Email
          email: payload.toEmail,
          to_email: payload.toEmail,
          customer_email: payload.toEmail,
          buyer_email: payload.toEmail,
          recipient_email: payload.toEmail,
          customerEmail: payload.toEmail,
          buyerEmail: payload.toEmail,
          toEmail: payload.toEmail,

          // Contact Number / Phone
          contact_number: cleanPhone,
          phone: cleanPhone,
          phone_number: cleanPhone,
          customer_phone: cleanPhone,
          buyer_phone: cleanPhone,
          contact_no: cleanPhone,
          mobile: cleanPhone,
          contactNumber: cleanPhone,
          phoneNumber: cleanPhone,
          customerPhone: cleanPhone,

          // Product Link / Download Link
          product_link: fallbackLink,
          download_link: fallbackLink,
          link: fallbackLink,
          product_url: fallbackLink,
          download_url: fallbackLink,
          productLink: fallbackLink,
          downloadLink: fallbackLink,
          file_link: fallbackLink,
          asset_link: fallbackLink,
          url: fallbackLink,

          // Product Title / Name
          product_name: payload.productName,
          product_title: payload.productName,
          title: payload.productName,
          item_name: payload.productName,
          productName: payload.productName,
          productTitle: payload.productName,

          // Pricing & Order Info
          amount: formattedAmount,
          price: formattedAmount,
          total: formattedAmount,
          order_amount: formattedAmount,
          order_id: payload.orderId,
          orderId: payload.orderId,
          order_date: orderDate,
          orderDate: orderDate,
          date: orderDate,
        },
      }),
    });
    if (!response.ok) {
      console.error(
        new Error(`EmailJS send failed (${response.status}): ${await response.text()}`),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("sendReceiptEmail exception:", error);
    return false;
  }
}
