// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside Lovable (e.g. Vercel CI) honour NITRO_PRESET so the build emits the
// right server output. Inside Lovable the preset is forced to Cloudflare anyway.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore if missing
  }
}

const preset = process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : undefined);

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
    define: {
      // Supabase Client
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env["VITE_SUPABASE_URL"] ||
          process.env["SUPABASE_URL"] ||
          process.env["STORE_SUPABASE_URL"] ||
          "https://wylcbblegcyzunychqqa.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTA0OTgsImV4cCI6MjEwMDYyNjQ5OH0.dkFbE5steNuvDJtor-DSAyWHaTHjSMk0Uwa6RXasaFg",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["SUPABASE_ANON_KEY"] ||
          process.env["STORE_SUPABASE_PUBLISHABLE_KEY"] ||
          "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV",
      ),

      // Supabase Server
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env["SUPABASE_URL"] ||
          process.env["VITE_SUPABASE_URL"] ||
          process.env["STORE_SUPABASE_URL"] ||
          "https://wylcbblegcyzunychqqa.supabase.co",
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env["SUPABASE_ANON_KEY"] ||
          process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTA0OTgsImV4cCI6MjEwMDYyNjQ5OH0.dkFbE5steNuvDJtor-DSAyWHaTHjSMk0Uwa6RXasaFg",
      ),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          "sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV",
      ),
      "process.env.SUPABASE_SERVICE_ROLE_KEY": JSON.stringify(
        process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
          process.env["STORE_SUPABASE_SERVICE_ROLE_KEY"] ||
          process.env["SUPABASE_SERVICE_KEY"] ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGNiYmxlZ2N5enVueWNocXFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA1MDQ5OCwiZXhwIjoyMTAwNjI2NDk4fQ.iBHks-KtL5UjXjD3aaGfPjmzOWOVCGA1JXaaAojt4gE",
      ),

      // Cashfree Payments
      "process.env.CASHFREE_APP_ID": JSON.stringify(
        process.env["CASHFREE_APP_ID"] || "1348337cd58fd2946007d114ebb7338431",
      ),
      "process.env.CASHFREE_SECRET_KEY": JSON.stringify(
        process.env["CASHFREE_SECRET_KEY"] ||
          "cfsk_ma_prod_c0607dab370ee9b4fbd58e8777883cce_36d411fa",
      ),
      "process.env.CASHFREE_MODE": JSON.stringify(process.env["CASHFREE_MODE"] || "production"),
      "import.meta.env.VITE_CASHFREE_MODE": JSON.stringify(
        process.env["VITE_CASHFREE_MODE"] || process.env["CASHFREE_MODE"] || "production",
      ),

      // EmailJS Receipts & Notifications
      "process.env.EMAILJS_PUBLIC_KEY": JSON.stringify(
        process.env["EMAILJS_PUBLIC_KEY"] || "yMInTQ6igoNvRwpNk",
      ),
      "import.meta.env.VITE_EMAILJS_PUBLIC_KEY": JSON.stringify(
        process.env["VITE_EMAILJS_PUBLIC_KEY"] ||
          process.env["EMAILJS_PUBLIC_KEY"] ||
          "yMInTQ6igoNvRwpNk",
      ),
      "process.env.EMAILJS_PRIVATE_KEY": JSON.stringify(
        process.env["EMAILJS_PRIVATE_KEY"] || "OYOXv27MB1DgFVE53imjc",
      ),
      "process.env.EMAILJS_SERVICE_ID": JSON.stringify(
        process.env["EMAILJS_SERVICE_ID"] || "service_tbk5flg",
      ),
      "import.meta.env.VITE_EMAILJS_SERVICE_ID": JSON.stringify(
        process.env["VITE_EMAILJS_SERVICE_ID"] || "service_tbk5flg",
      ),
      "process.env.EMAILJS_TEMPLATE_ID": JSON.stringify(
        process.env["EMAILJS_TEMPLATE_ID"] || "template_e8uqzpz",
      ),
      "import.meta.env.VITE_EMAILJS_TEMPLATE_ID": JSON.stringify(
        process.env["VITE_EMAILJS_TEMPLATE_ID"] || "template_e8uqzpz",
      ),

      // Google OAuth
      "process.env.GOOGLE_CLIENT_ID": JSON.stringify(
        process.env["GOOGLE_CLIENT_ID"] ||
          "188905543783-v3b535ku8mvs3pdavt5tfviv9tsqer4h.apps.googleusercontent.com",
      ),
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(
        process.env["VITE_GOOGLE_CLIENT_ID"] ||
          process.env["GOOGLE_CLIENT_ID"] ||
          "188905543783-v3b535ku8mvs3pdavt5tfviv9tsqer4h.apps.googleusercontent.com",
      ),
      "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(
        process.env["GOOGLE_CLIENT_SECRET"] || "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",
      ),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    client: { entry: "client" },
  },
  ...(preset ? { nitro: { preset } } : {}),
});
