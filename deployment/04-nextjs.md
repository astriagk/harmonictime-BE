# Next.js App Deployment — Vercel

Vercel is built by the Next.js team — zero-config deployment, free tier is generous for early stage.

## Prerequisites

- Next.js repo pushed to GitHub
- Backend API URL from Railway (e.g. `https://kronosquare-be.up.railway.app`)

## 1. Import Project to Vercel

1. Sign up / log in at https://vercel.com (use GitHub login)
2. Click **Add New → Project**
3. Select your Next.js repository from GitHub
4. Vercel auto-detects Next.js — no build config needed

## 2. Environment Variables

Before deploying, add your environment variables under **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://kronosquare-be.up.railway.app
NEXT_PUBLIC_SOCKET_URL=https://kronosquare-be.up.railway.app
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_<your-live-key-id>
```

> Variables prefixed `NEXT_PUBLIC_` are exposed to the browser.
> Server-only secrets (no prefix) are only available in API routes and server components.

Add any other variables your Next.js app needs here.

## 3. Deploy

Click **Deploy** — Vercel builds and publishes in ~1–2 minutes.

You get a URL like: `https://krono-square.vercel.app`

## 4. Custom Domain (Free)

1. Go to your project → **Settings → Domains**
2. Add your domain: `kronosquare.in` or `app.kronosquare.in`
3. Vercel shows you DNS records to add at your registrar:
   ```
   Type:  A
   Name:  @
   Value: 76.76.21.21
   ```
4. SSL is automatic and free

## 5. Auto-deploys on Push

Every push to your main branch triggers a production deploy.
Every pull request gets a unique preview URL — useful for QA.

## 6. Redeploy with New Env Vars

If you add or change environment variables:
1. Go to **Settings → Environment Variables** → update the value
2. Go to **Deployments** → click the three dots on the latest deploy → **Redeploy**

## Free Tier Limits

| Limit | Value |
|---|---|
| Bandwidth | 100 GB/month |
| Serverless function invocations | 100,000/month |
| Build minutes | 6,000/month |
| Projects | Unlimited |

## When to Upgrade to Vercel Pro ($20/mo)

- Bandwidth exceeds 100GB/month
- You need password-protected preview deployments
- You need advanced analytics or web vitals
