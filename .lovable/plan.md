## What's actually wrong

I checked your live database. The `user_roles` table has exactly **one** row, and it is a plain `user` role. Your owner account `growchannel2026@gmail.com` (user id `fb491a45-…`) has **no role row at all**, so the app correctly decides you are not an admin and hides the panel.

Reason: the auto-grant trigger in `schema.sql` only fires when a *new* account is created. Your accounts existed before the schema was run, so nobody was ever granted `admin`.

## Plan

**1. Grant admin to the owner account (one copy-paste SQL snippet)**

A short SQL block you paste into the Supabase SQL editor that inserts the `admin` role for `growchannel2026@gmail.com` by looking it up in `auth.users`, plus a backfill so any existing account without a role gets `user`. Idempotent — safe to re-run.

**2. Make `/admin` invisible to non-admins**

Currently `/admin` renders an "access denied" card, which confirms the page exists. Change it so the route:
- checks the session and the `has_role(uid,'admin')` result before rendering anything, and
- throws TanStack's `notFound()` when the visitor is not an admin, so they get the site's standard **Page Not Found** screen — identical to a random bad URL, whether signed out or signed in as a normal user.

The route stays `ssr: false` and keeps `robots: noindex`. The header's admin icon is already conditional on `isAdmin`, so it stays hidden.

**3. Keep the server side authoritative**

Every admin write already goes through Postgres RLS (`is_admin()`), so hiding the page is cosmetic only — a normal user still cannot change data even if they hand-craft requests. I'll re-verify the admin server functions all call `requireAdmin` and fix any that don't.

**4. Admin-grants-access flow**

The Admins tab already exists in the panel. I'll verify it can add another user's email as admin and remove them, and that it reads/writes `user_roles` correctly under RLS (`admins manage roles` policy) — fixing it if the lookup by email is broken, since `auth.users` isn't readable from the browser (needs a server function using the service role).

**5. Verify**

- Sign in as `growchannel2026@gmail.com` → admin icon appears, `/admin` loads.
- Sign in as `yjha019@gmail.com` → `/admin` shows Page Not Found, no admin icon.
- Signed out → `/admin` shows Page Not Found.

## Technical notes

- `AuthContext` already queries `user_roles` for the admin row; no change needed once the row exists.
- Admin gating in the route will use a small server function (`requireAdmin`) rather than trusting the client-side query alone, so the Not Found decision can't be flipped from devtools.
- No schema migration needed beyond the role insert.
