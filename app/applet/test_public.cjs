const { createClient } = require("@supabase/supabase-js");

const url = "https://wylcbblegcyzunychqqa.supabase.co";
const pubKey = "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV";

const publicClient = createClient(url, pubKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data, error } = await publicClient
    .from("products")
    .select("*")
    .eq("active", true);
  console.log("Data length:", data ? data.length : null);
  console.log("Error:", error);
}

run();
