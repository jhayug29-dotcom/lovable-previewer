# Editly Store — copy & paste setup

Everything below is ready to paste. Do the four steps in order.

---

## 1. Supabase — create the database

Supabase Dashboard → **SQL Editor** → **New query** → paste the **entire** contents of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Then a second query: paste the entire contents of
[`supabase/seed.sql`](supabase/seed.sql) → **Run**.
(That fills the store with the 4 packs + their reviews. Both files are safe to re-run.)

---

## 2. Vercel — environment variables

Vercel → your project → **Settings** → **Environment Variables** → for each row below,
paste the name and the value, tick **Production + Preview + Development**, Save.

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://wylcbblegcyzunychqqa.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV` |
| `SUPABASE_URL` | `https://wylcbblegcyzunychqqa.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_DP56-TYWMUcKiJh_Pl_JxQ_JtgqeYuV` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_Y-grezvFAlZJDkZlW96gVA_splbGR9O` |
| `CASHFREE_APP_ID` | `1348337cd58fd2946007d114ebb7338431` |
| `CASHFREE_SECRET_KEY` | `cfsk_ma_prod_c0607dab370ee9b4fbd58e8777883cce_36d411fa` |
| `EMAILJS_PUBLIC_KEY` | `yMInTQ6igoNvRwpNk` |
| `EMAILJS_PRIVATE_KEY` | `OYOXv27MB1DgFVE53imjc` |
| `VITE_EMAILJS_PUBLIC_KEY` | `yMInTQ6igoNvRwpNk` |
| `VITE_EMAILJS_SERVICE_ID` | `service_tbk5flg` |
| `VITE_EMAILJS_TEMPLATE_ID` | `template_e8uqzpz` |
| `NITRO_PRESET` | `vercel` |

Leave `CASHFREE_MODE` **unset** for live payments. Set it to `sandbox` (and
`VITE_CASHFREE_MODE=sandbox`) only while testing.

After saving, **Deployments → ⋯ → Redeploy** (uncheck "use existing build cache").

---

## 3. Google sign-in

**Google Cloud Console** → APIs & Services → Credentials → your OAuth client →
**Authorised redirect URIs** → Add:

```
https://wylcbblegcyzunychqqa.supabase.co/auth/v1/callback
```

**Authorised JavaScript origins** → Add:

```
https://editly-store.vercel.app
```

**Supabase** → Authentication → **Providers → Google** → Enable, then paste:

- Client ID: `188905543783-...apps.googleusercontent.com` (from your keys file)
- Client secret: (from your keys file)

**Supabase** → Authentication → **URL Configuration**:

- Site URL: `https://editly-store.vercel.app`
- Additional redirect URLs:

```
https://editly-store.vercel.app/auth/callback
http://localhost:8080/auth/callback
```

---

## 4. Cashfree webhook

Cashfree Merchant Dashboard → **Developers → Webhooks → Add endpoint**, paste:

```
https://editly-store.vercel.app/api/public/cashfree-webhook
```

Events: **Payment Success** and **Payment Failed**.

---

## 5. Make yourself admin

The schema auto-grants admin to the owner email on signup. If you signed up before
running the schema, run this once in the SQL Editor (replace the email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR@EMAIL.COM'
on conflict do nothing;
```

Then open `https://editly-store.vercel.app/admin`.

---

## Security note

The service-role key and the Cashfree secret above were shared in plain chat.
Once the site is live, rotate both (Supabase → Settings → API → Rotate;
Cashfree → Developers → API Keys → Regenerate) and update the two Vercel
variables with the new values.
