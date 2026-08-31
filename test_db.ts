import { adminClient } from "./src/lib/supabase.server.js";

async function run() {
  const { data, error } = await adminClient()
    .from("products")
    .select("id, slug, title, price, is_free, download_link")
    .eq("slug", "some-slug")
    .maybeSingle();
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
