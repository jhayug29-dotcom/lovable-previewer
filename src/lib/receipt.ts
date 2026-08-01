import emailjs from "@emailjs/browser";
import { EMAILJS, isEmailjsConfigured } from "./email-config";

export type ReceiptInput = {
  toEmail: string;
  customerName: string;
  productName: string;
  amount: number;
  orderId: string;
  downloadLink: string;
};

/** Sends the purchase receipt from the browser using EmailJS. */
export async function sendReceipt(input: ReceiptInput): Promise<boolean> {
  if (!isEmailjsConfigured()) return false;

  await emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateId,
    {
      to_email: input.toEmail,
      customer_name: input.customerName,
      product_name: input.productName,
      amount: `₹${input.amount.toLocaleString("en-IN")}`,
      order_id: input.orderId,
      order_date: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      download_link: input.downloadLink,
    },
    { publicKey: EMAILJS.publicKey },
  );
  return true;
}
