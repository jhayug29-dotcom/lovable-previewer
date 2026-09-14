import { loadProducts, clearCatalogCache } from "./src/lib/catalog.server.ts";
async function test() {
  clearCatalogCache();
  const products = await loadProducts();
  console.log("Count:", products.length);
  console.log(
    "Titles:",
    products.map((p) => p.title),
  );
}
test();
