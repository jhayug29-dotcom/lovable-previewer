import { createFileRoute } from "@tanstack/react-router";
import { loadProducts } from "@/lib/catalog.server";
import { SITE_URL } from "@/lib/seo";

/**
 * Dynamic XML Sitemap endpoint for search engine crawlers (Googlebot, Bingbot, etc.).
 * Automatically includes all active products fetched from Supabase / catalogue.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let products: Array<{ slug: string; updated_at?: string }> = [];
        try {
          products = await loadProducts();
        } catch {
          products = [];
        }

        const nowIso = new Date().toISOString().split("T")[0];

        const staticPages = [
          {
            loc: `${SITE_URL}/`,
            lastmod: nowIso,
            changefreq: "daily",
            priority: "1.0",
          },
          {
            loc: `${SITE_URL}/store`,
            lastmod: nowIso,
            changefreq: "daily",
            priority: "0.9",
          },
          {
            loc: `${SITE_URL}/read-more`,
            lastmod: nowIso,
            changefreq: "weekly",
            priority: "0.7",
          },
        ];

        const productPages = products.map((p) => ({
          loc: `${SITE_URL}/product/${p.slug}`,
          lastmod: nowIso,
          changefreq: "weekly",
          priority: "0.8",
        }));

        const allUrls = [...staticPages, ...productPages];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (item) => `  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
