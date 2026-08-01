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
  productName: string;
  amount: number;
  orderId: string;
  downloadLink: string;
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
          to_email: payload.toEmail,
          customer_name: payload.customerName,
          product_name: payload.productName,
          amount: `₹${payload.amount.toLocaleString("en-IN")}`,
          order_id: payload.orderId,
          order_date: new Date().toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }),
          download_link: payload.downloadLink,
        },
      }),
    });
    if (!response.ok) {
      console.error(new Error(`EmailJS send failed (${response.status}): ${await response.text()}`));
      return false;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
