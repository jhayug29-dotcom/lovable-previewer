import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createOrder, verifyOrder, claimFree } from "./cashfree.server";
import { generateReviews } from "./ai-reviews.server";

export const createCashfreeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().min(1),
        origin: z.string().url(),
        customerName: z.string().min(1),
        customerEmail: z.string().email(),
        customerPhone: z.string().min(6),
        couponCode: z.string().optional(),
        accessToken: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => createOrder(data));

export const verifyCashfreeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => verifyOrder(data.orderId));

export const claimFreeProduct = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ slug: z.string().min(1), accessToken: z.string().optional() }).parse(data))
  .handler(async ({ data }) => claimFree(data.slug, data.accessToken));

export const generateAiReviews = createServerFn({ method: "POST" })
  .inputValidator((data) =>
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
  .handler(async ({ data }) => generateReviews(data));
