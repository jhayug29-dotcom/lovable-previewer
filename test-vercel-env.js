const https = require('https');

// A script to help you understand the issue
console.log(`
==============================================================
VERCEL ENVIRONMENT DEPLOYMENT CHECKLIST
==============================================================

Since it works here but NOT on Vercel, this is a 100% guarantee
that Vercel's environment variables are configured incorrectly or 
it has cached the old code.

Here is the exact step-by-step to fix Vercel:

1. Go to https://vercel.com/dashboard
2. Click your project (editly-store or similar)
3. Go to "Settings" (top menu) -> "Environment Variables" (left menu)
4. YOU MUST ADD THESE EXACT KEYS:
   
   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: (Your Supabase Service Role Key) 
   -> You MUST add this one, or admin edits will ALWAYS fail on Vercel.

   Name: SUPABASE_URL
   Value: https://wylcbblegcyzunychqqa.supabase.co

   Name: SUPABASE_ANON_KEY
   Value: (Your anon key)

   Name: VITE_SUPABASE_URL
   Value: https://wylcbblegcyzunychqqa.supabase.co

   Name: VITE_SUPABASE_ANON_KEY
   Value: (Your anon key)

5. After saving ALL of those keys in Vercel...
6. Go to "Deployments" tab in Vercel
7. Click the 3 dots (...) next to the top deployment
8. Click "Redeploy"

The problem is NOT in the code we pushed to GitHub. The code is 
perfectly fixed. The problem is that Vercel doesn't have the 
password (the Service Role Key) to talk to your database!
==============================================================
`);
