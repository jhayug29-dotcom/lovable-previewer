import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createCashfreeOrder = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        productId: z.string().optional(),
        slug: z.string().min(1),
        origin: z.string().url(),
        customerName: z.string().min(1),
        customerEmail: z.string().email(),
        customerPhone: z.string().min(6),
        couponCode: z.string().optional(),
        accessToken: z.string().optional(),
        collaboratorCode: z
          .string()
          .regex(/^[a-zA-Z0-9_-]{8,80}$/)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createOrder } = await import("./cashfree.server");
    return createOrder(data);
  });

export const verifyCashfreeOrder = createServerFn({ method: "POST" })
  .validator((data) => z.object({ orderId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { verifyOrder } = await import("./cashfree.server");
    return verifyOrder(data.orderId);
  });

export const resendReceiptEmail = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        orderId: z.string().min(1),
        email: z.string().email().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { resendOrderReceipt } = await import("./cashfree.server");
    return resendOrderReceipt(data.orderId, data.email);
  });

export const claimFreeProduct = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        productId: z.string().optional(),
        slug: z.string().min(1),
        accessToken: z.string().optional(),
        collaboratorCode: z
          .string()
          .regex(/^[a-zA-Z0-9_-]{8,80}$/)
          .optional(),
        userEmail: z.string().optional(),
        userName: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { claimFree } = await import("./cashfree.server");
    return claimFree(
      data.slug,
      data.accessToken,
      data.collaboratorCode,
      data.userEmail,
      data.userName,
      data.productId,
    );
  });

export const generateAiReviews = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        accessToken: z.string().optional(),
        productId: z.string().min(1),
        productTitle: z.string().min(1),
        description: z.string().min(1),
        count: z.number().int().min(1).max(12),
        save: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { generateReviews } = await import("./ai-reviews.server");
    return generateReviews(data);
  });
