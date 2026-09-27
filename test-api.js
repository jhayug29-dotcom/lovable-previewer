const { createClient } = require("@supabase/supabase-js");
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  console.log("Supabase URL and Service Role Key must be set in environment.");
  process.exit(0);
}

async function testVercelAPI() {
  const sb = createClient(url, service);
  
  // We will check if the user is in the admin role table.
  const { data: roles, error: roleError } = await sb.from("user_roles").select("*");
  console.log("Admin Roles currently in DB:", roles);
}
testVercelAPI();
