import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.object({ accessToken: z.string().optional() });

/** Admin or seller access + the product scope for sellers. */
export const checkPanelAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { panelAccess } = await import("./analytics.server");
    return panelAccess(data.accessToken);
  });

export const fetchAnalytics = createServerFn({ method: "POST" })
  .inputValidator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { getAnalytics } = await import("./analytics.server");
    return getAnalytics(data.accessToken);
  });

export const fetchSellers = createServerFn({ method: "POST" })
  .inputValidator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { listSellers } = await import("./analytics.server");
    return listSellers(data.accessToken);
  });

export const saveSellerProducts = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { setSellerProducts } = await import("./analytics.server");
    return setSellerProducts(data.accessToken, data.userId, data.productIds);
  });
