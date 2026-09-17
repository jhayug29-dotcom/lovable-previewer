import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const cartItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  isFree: z.boolean().optional(),
});

export const checkoutCart = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        items: z.array(cartItemSchema),
        origin: z.string(),
        customerName: z.string(),
        customerEmail: z.string().email(),
        customerPhone: z.string(),
        couponCode: z.string().optional(),
        accessToken: z.string().optional(),
        collaboratorCode: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createCartOrder } = await import("./cart.server");
    return createCartOrder(data);
  });

export const checkoutFreeCart = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        items: z.array(cartItemSchema),
        customerName: z.string(),
        customerEmail: z.string().email(),
        customerPhone: z.string().optional(),
        accessToken: z.string().optional(),
        collaboratorCode: z.string().optional(),
        origin: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { claimFreeCart } = await import("./cart.server");
    return claimFreeCart(data);
  });
