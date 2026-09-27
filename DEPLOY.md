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

| Name                            | Value                                                    |
| ------------------------------- | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | `https://<YOUR_PROJECT_REF>.supabase.co`                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<YOUR_SUPABASE_ANON_KEY>`                               |
| `SUPABASE_URL`                  | `https://<YOUR_PROJECT_REF>.supabase.co`                 |
| `SUPABASE_PUBLISHABLE_KEY`      | `<YOUR_SUPABASE_ANON_KEY>`                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | `<YOUR_SUPABASE_SERVICE_ROLE_KEY>`                       |
| `SUPABASE_SECRET_KEY`           | `<YOUR_SUPABASE_SERVICE_ROLE_KEY>`                       |
| `CASHFREE_APP_ID`               | `<YOUR_CASHFREE_APP_ID>`                                 |
| `CASHFREE_SECRET_KEY`           | `<YOUR_CASHFREE_SECRET_KEY>`                             |
| `EMAILJS_PUBLIC_KEY`            | `<YOUR_EMAILJS_PUBLIC_KEY>`                              |
| `EMAILJS_PRIVATE_KEY`           | `<YOUR_EMAILJS_PRIVATE_KEY>`                             |
| `VITE_EMAILJS_PUBLIC_KEY`       | `<YOUR_EMAILJS_PUBLIC_KEY>`                              |
| `VITE_EMAILJS_SERVICE_ID`       | `<YOUR_EMAILJS_SERVICE_ID>`                              |
| `VITE_EMAILJS_TEMPLATE_ID`      | `<YOUR_EMAILJS_TEMPLATE_ID>`                             |
| `NITRO_PRESET`                  | `vercel`                                                 |

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
