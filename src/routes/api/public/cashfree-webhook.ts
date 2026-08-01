import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { finalizeOrder } from "@/lib/cashfree.server";

/**
 * Cashfree PG webhook — marks orders PAID automatically so delivery never
 * depends on the buyer landing back on /payment/status.
 * Configure this URL in the Cashfree dashboard: /api/public/cashfree-webhook
 */
export const Route = createFileRoute("/api/public/cashfree-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-webhook-signature");
        const timestamp = request.headers.get("x-webhook-timestamp");
        const secret = process.env["CASHFREE_SECRET_KEY"];

        if (!secret) return new Response("Not configured", { status: 500 });
        if (!signature || !timestamp) return new Response("Missing signature", { status: 401 });

        const expected = createHmac("sha256", secret).update(`${timestamp}${raw}`).digest("base64");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw) as {
          type?: string;
          data?: { order?: { order_id?: string } };
        };
        const orderId = event.data?.order?.order_id;
        if (!orderId) return new Response("ok");

        if (event.type === "PAYMENT_SUCCESS_WEBHOOK") {
          await finalizeOrder(orderId, "PAID");
        } else if (event.type === "PAYMENT_FAILED_WEBHOOK") {
          await finalizeOrder(orderId, "FAILED");
        }

        return new Response("ok");
      },
    },
  },
});
