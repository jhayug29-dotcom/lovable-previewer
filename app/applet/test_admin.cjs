const { createClient } = require("@supabase/supabase-js");

const url = "https://wylcbblegcyzunychqqa.supabase.co";
// From the user prompt:
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE";

const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data, error } = await adminClient.from("products").select("id, slug, title, price, is_free, download_link").eq("slug", "Realestate Text").maybeSingle();
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
