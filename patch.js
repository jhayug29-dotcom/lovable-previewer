const fs = require("fs");
const file = "/src/lib/cashfree.server.ts";
let code = fs.readFileSync(file, "utf-8");

code = code.replace(
  /async function loadProduct\(slug: string\): Promise<ProductRow> \{[\s\S]*?return data as ProductRow;\n\}/,
  `async function loadProduct(slug: string): Promise<ProductRow> {
  const { loadProduct: fetchCatalogProduct } = await import("./catalog.server");
  const product = await fetchCatalogProduct(slug);
  if (!product) throw new Error("Product unavailable. Please refresh and try again.");
  return {
    id: product.id!,
    slug: product.slug,
    title: product.title,
    price: product.price,
    is_free: product.isFree,
    download_link: product.downloadLink ?? null,
  };
}`,
);

fs.writeFileSync(file, code);
