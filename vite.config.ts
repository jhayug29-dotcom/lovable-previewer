// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside Lovable (e.g. Vercel CI) honour NITRO_PRESET so the build emits the
// right server output. Inside Lovable the preset is forced to Cloudflare anyway.
const preset = process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : undefined);

const cashfreeSalePricingGuard = {
  name: "editly-cashfree-sale-pricing-guard",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.replaceAll("\\", "/").endsWith("/src/lib/cashfree.server.ts")) return null;

    const duplicateSaleLine =
      "  const salePrice = await applySalePricing(product.id, Number(product.price));\n  const amount = await applyCoupon(salePrice, input.couponCode, product.id);";
    const correctedLine =
      "  // catalog.loadProduct() already applies the active store sale; never discount the sale price twice.\n  const amount = await applyCoupon(Number(product.price), input.couponCode, product.id);";

    if (code.includes(duplicateSaleLine)) {
      return {
        code: code.replace(duplicateSaleLine, correctedLine),
        map: null,
      };
    }

    // Already fixed (or intentionally changed upstream); do not alter the module.
    return null;
  },
};

export default defineConfig({
  vite: {
    plugins: [cashfreeSalePricingGuard],
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(preset ? { nitro: { preset } } : {}),
});
