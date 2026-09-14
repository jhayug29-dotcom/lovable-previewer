const fs = require('fs');

let sbPath = 'src/lib/supabase.server.ts';
let sb = fs.readFileSync(sbPath, 'utf8');

sb = sb.replace(
  'function getServiceRoleKey(): string {',
  `function getServiceRoleKey(): string {
  return (
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    getEnv("STORE_SUPABASE_SERVICE_ROLE_KEY") ??
    DEFAULT_SUPABASE_SERVICE_ROLE_KEY
  );
}

function oldGetServiceRoleKey(): string {`
);

fs.writeFileSync(sbPath, sb);

console.log("Patched service role fallback");
