<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

<!-- BASE44:BEGIN -->
## Base44 dev environment

- Run: `docker compose -f docker-compose.base44.yml up -d` (node:22 image, deps installed at
  startup into a named volume, `vite dev` on port 3000 with HMR).
- `vite.config.ts` sets `vite.server.host: true` + `allowedHosts: true` so the proxied
  preview hostname isn't blocked (Vite returns 403 otherwise).
- Supabase URL + publishable key are hardcoded fallbacks in `src/integrations/supabase/client.ts`
  and `src/lib/supabase.server.ts`, so the storefront renders with no env vars at all.
- Server-only features need secrets from `/run/base44/app.env`: `SUPABASE_SERVICE_ROLE_KEY`
  (admin/checkout), `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` (payments, set `CASHFREE_MODE=sandbox`
  while testing), `GEMINI_API_KEY` (AI reviews/support).
- Verify: `curl -H "Host: x.example.com" http://localhost:3000/` returns HTML (200).
<!-- BASE44:END -->
