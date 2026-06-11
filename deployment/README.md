# Deployment Guide — Krono Square

Early-stage production deployment across all apps with cost-cutting in mind.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│                                                             │
│   Angular App               Next.js App                    │
│   Cloudflare Pages          Vercel                         │
│   (free)                    (free)                         │
└──────────────────┬──────────────────┬───────────────────────┘
                   │                  │
                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND LAYER                         │
│                                                             │
│              Node.js + Express API                          │
│              Railway  ($5/mo)                               │
│              • Socket.io (real-time)                        │
│              • node-cron (scheduled jobs)                   │
│              • REST API                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ MongoDB Atlas│  │   AWS S3     │  │ Third-party  │
│ M0 Free      │  │   Storage    │  │ Services     │
│ (free)       │  │   (~$2/mo)   │  │ (usage-based)│
└──────────────┘  └──────────────┘  └──────────────┘
```

## Monthly Cost Summary

| Service | Platform | Cost |
|---|---|---|
| Angular app | Cloudflare Pages | $0 |
| Next.js app | Vercel | $0 |
| Backend API | Railway Starter | $5 |
| Database | MongoDB Atlas M0 | $0 |
| File storage | AWS S3 | ~$1–3 |
| Email | Brevo (300/day free) | $0 |
| Image hosting | ImgBB | $0 |
| Courier tracking | TrackingMore Free | $0 |
| OTP / SMS | Twilio Verify | ~$5–15 |
| Domain | Namecheap / GoDaddy | ~$1 |
| **Total** | | **~$12–24/month** |

> Twilio OTP is the biggest variable — $0.05 per verification sent.

## Deployment Order

Follow these docs in sequence:

1. [MongoDB Atlas](./01-mongodb.md) — database first, you need the connection string for the backend
2. [Backend on Railway](./02-backend.md) — API server, needs Mongo URI and all third-party keys
3. [Angular on Cloudflare Pages](./03-angular.md) — needs the backend API URL
4. [Next.js on Vercel](./04-nextjs.md) — needs the backend API URL
5. [Email (Brevo)](./05-email-brevo.md) — swap Gmail for a production SMTP sender
6. [Third-party Services](./06-third-party.md) — AWS S3, Twilio, Razorpay, TrackingMore, ImgBB
7. [Environment Variables Reference](./07-env-reference.md) — full list of all env vars

## Scale-up Triggers

| When | Action | Cost delta |
|---|---|---|
| MongoDB > 512MB or 100 connections | Upgrade to Atlas M2 | +$9/mo |
| Backend needs more memory/CPU | Railway Pro | +$15/mo |
| Next.js hits Vercel bandwidth | Vercel Pro | +$20/mo |
| > 50 shipments tracked/month | TrackingMore Basic | +$9/mo |
| > 300 emails/day | Brevo Starter | +$25/mo |
