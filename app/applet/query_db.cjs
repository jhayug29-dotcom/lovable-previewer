const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://wylcbblegcyzunychqqa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
