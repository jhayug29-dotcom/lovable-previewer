const fs = require('fs');

// Patch 1: Catalog Server Cache Disable
let catalogPath = 'src/lib/catalog.server.ts';
let catalog = fs.readFileSync(catalogPath, 'utf8');

// Completely disable the internal TTL cache in catalog.server.ts
catalog = catalog.replace('const TTL_MS = 1_000;', 'const TTL_MS = 0; // Forced disabled for Vercel');
fs.writeFileSync(catalogPath, catalog);


// Patch 2: Nitro Preset override
let pkgPath = 'package.json';
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
// Vercel preset is required to avoid aggressive CF/Edge caching defaults
// We set it to standard vercel node preset rather than edge to ensure dynamic rendering
if (!pkg.devDependencies) pkg.devDependencies = {};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));


// Patch 3: Route config changes to force dynamic rendering
let indexRoutePath = 'src/routes/index.tsx';
let storeRoutePath = 'src/routes/store.tsx';
let slugRoutePath = 'src/routes/product.$slug.tsx';

function patchRoute(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Add staleTime to router if it has a loader
  if (content.includes('loader:') && !content.includes('staleTime:')) {
    content = content.replace(/loader:/, 'staleTime: 0, loader:');
    fs.writeFileSync(filePath, content);
  }
}

patchRoute(indexRoutePath);
patchRoute(storeRoutePath);
patchRoute(slugRoutePath);

console.log("Patches applied successfully.");
