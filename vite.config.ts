// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside Lovable (e.g. Vercel CI) honour NITRO_PRESET so the build emits the
// right server output. Inside Lovable the preset is forced to Cloudflare anyway.
const preset = process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : undefined);

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env["VITE_SUPABASE_URL"] ||
          process.env["SUPABASE_URL"] ||
          process.env["STORE_SUPABASE_URL"] ||
          "",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ||
          "",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"] ||
          process.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ||
          "",
      ),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(preset ? { nitro: { preset } } : {}),
});
