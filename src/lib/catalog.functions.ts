import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public catalog reads. No auth: safe to call from public route loaders and SSR. */
export const getStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { loadProducts } = await import("./catalog.server");
  return loadProducts();
});

export const getStoreProduct = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { loadProduct, loadProducts } = await import("./catalog.server");
    const [product, all] = await Promise.all([loadProduct(data.slug), loadProducts()]);
    return { product, related: all.filter((p) => p.slug !== data.slug).slice(0, 3) };
  });

/** Active sale + festive banners for the storefront. Public, cached server-side. */
export const getStorePromos = createServerFn({ method: "GET" }).handler(async () => {
  const { loadPromos } = await import("./catalog.server");
  return loadPromos();
});
