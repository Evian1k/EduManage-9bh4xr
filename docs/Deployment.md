# Deployment Guide

## Step 1: Create Supabase Project
Create project at supabase.com (Team or Enterprise plan for 10M+ scale).

## Step 2: Run Migrations
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```
3 migrations: foundation (12 tables), modules (65 tables), storage+extras.

## Step 3: Set Edge Function Secrets
```bash
supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=sk-...
supabase secrets set EMAIL_PROVIDER=sendgrid SENDGRID_API_KEY=SG...
supabase secrets set SMS_PROVIDER=africa_talking AFRICAS_TALKING_API_KEY=...
supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set MPESA_CONSUMER_KEY=... MPESA_SHORTCODE=... MPESA_PASSKEY=...
supabase secrets set CRON_API_KEY=<random-64-chars>
```

## Step 4: Deploy Edge Functions
```bash
supabase functions deploy ai-assistant
supabase functions deploy send-notifications
supabase functions deploy verify-domain
supabase functions deploy send-push-notification
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy mpesa-stk
supabase functions deploy mpesa-callback
```

## Step 5: Configure App
```bash
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm install
pnpm start
```

## Step 6: Build for Production
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit -p android --latest
eas submit -p ios --latest
```

## Step 7: Configure Webhooks
- Stripe Dashboard → Webhooks → Add endpoint: `https://YOUR-PROJECT.functions.supabase.co/stripe-webhook`
- M-Pesa Daraja → Callback URL: `https://YOUR-PROJECT.functions.supabase.co/mpesa-callback`

## Step 8: Configure DNS
- Wildcard: `*.edumanage.com` → your web host
- Custom school domains: CNAME to your app

## CI/CD
GitHub Actions (6 workflows):
- `ci.yml` — test + build on every push
- `deploy-functions.yml` — deploy edge functions on push to main
- `migrate-db.yml` — run migrations on push to main
- `health-check.yml` — every 15 min
- `load-test.yml` — nightly k6
- `backup-db.yml` — daily pg_dump to S3
