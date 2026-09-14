// @lovable.dev/vite-tanstack-config already provides the standard TanStack Start,
// React, Tailwind, path aliases, VITE_* env injection, and Nitro integration.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env is optional on Vercel; runtime environment variables are authoritative.
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
  },
  tanstackStart: {
    server: { entry: "server" },
    client: { entry: "client" },
  },
  ...(preset ? { nitro: { preset } } : {}),
});
