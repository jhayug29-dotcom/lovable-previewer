const { createClient } = require("@supabase/supabase-js");
const url = "https://wylcbblegcyzunychqqa.supabase.co";
const service = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE";

async function testVercelAPI() {
  const sb = createClient(url, service);
  
  // Check if your user exists in the admin table
  const { data: roles, error: roleError } = await sb.from("user_roles").select("*");
  console.log("Admin Roles currently in DB:", roles);
}
testVercelAPI();
