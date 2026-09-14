import emailjs from "@emailjs/browser";
import { EMAILJS, isEmailjsConfigured } from "./email-config";

export type ReceiptInput = {
  toEmail: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  amount: number;
  orderId: string;
  downloadLink: string;
  storeName?: string;
};

/** Sends the purchase receipt from the browser using EmailJS. */
export async function sendReceipt(input: ReceiptInput): Promise<boolean> {
  if (!isEmailjsConfigured()) return false;

  const fallbackLink = (input.downloadLink || "").trim();
  const formattedAmount = `₹${input.amount.toLocaleString("en-IN")}`;
  const orderDate = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const storeName = input.storeName || "Editly Store";
  const cleanPhone = (input.customerPhone || "").trim();
  const cleanName =
    (input.customerName || "").trim() || input.toEmail.split("@")[0] || "Valued Customer";

  try {
    await emailjs.send(
      EMAILJS.serviceId,
      EMAILJS.templateId,
      {
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
        email: input.toEmail,
        to_email: input.toEmail,
        customer_email: input.toEmail,
        buyer_email: input.toEmail,
        recipient_email: input.toEmail,
        customerEmail: input.toEmail,
        buyerEmail: input.toEmail,
        toEmail: input.toEmail,

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
        product_name: input.productName,
        product_title: input.productName,
        title: input.productName,
        item_name: input.productName,
        productName: input.productName,
        productTitle: input.productName,

        // Pricing & Order Info
        amount: formattedAmount,
        price: formattedAmount,
        total: formattedAmount,
        order_amount: formattedAmount,
        order_id: input.orderId,
        orderId: input.orderId,
        order_date: orderDate,
        orderDate: orderDate,
        date: orderDate,
      },
      { publicKey: EMAILJS.publicKey },
    );
    return true;
  } catch (err) {
    console.error("Browser sendReceipt error:", err);
    return false;
  }
}
