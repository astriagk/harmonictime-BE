# Backend Deployment — Railway

The backend uses **Socket.io** and **node-cron**, both of which require a persistent,
always-on process. Railway Starter ($5/mo) gives you that — no cold starts.

> Do NOT use Render free tier, Vercel, or any serverless platform for this backend.

## Prerequisites

- MongoDB Atlas connection string (from `01-mongodb.md`)
- All third-party API keys ready (Twilio, Razorpay, S3, etc.)
- GitHub repository pushed with latest code

## 1. Create a Railway Project

1. Sign up / log in at https://railway.app (use GitHub login)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `kronosquare-BE` repository
4. Railway auto-detects Node.js

## 2. Configure Build & Start Commands

Railway reads `package.json` scripts automatically:
- **Install:** `npm install` (runs `postinstall` which runs `npm run build`)
- **Start:** `npm start` → `node dist/server.js`

No extra configuration needed — your `package.json` already has this set up correctly.

## 3. Set Environment Variables

Go to your Railway service → **Variables** tab → add each variable:

```
PORT=5000
MONGO_URI=mongodb+srv://kronosquare_api:<pass>@cluster.mongodb.net/kronosquare
DB_NAME=kronosquare

JWT_SECRET=<generate a 64-char random string>
JWT_EXPIRES_IN=15d
JWT_REFRESH_SECRET=<generate a different 64-char random string>
JWT_REFRESH_EXPIRES_IN=30d

FRONTEND_URL=https://your-angular-app.pages.dev

LOGO_URL=<public s3 url to krono square email logo>

EMAIL_USER=<brevo-smtp-login>
EMAIL_PASS=<brevo-smtp-key>
CONTACT_RECIPIENT=support@kronosquare.in

TWILIO_ACCOUNT_SID=<from twilio console>
TWILIO_AUTH_TOKEN=<from twilio console>
TWILIO_PHONE_NUMBER=<your twilio number>
TWILIO_VERIFY_SERVICE_SID=<from twilio verify service>

RAZORPAY_KEY_ID=rzp_live_<your-live-key-id>
RAZORPAY_KEY_SECRET=<from razorpay dashboard>
RAZORPAY_ACCOUNT_NUMBER=<your razorpay x account>

IMGBB_API_KEY=<from imgbb>

STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=<aws iam key>
STORAGE_SECRET_KEY=<aws iam secret>
STORAGE_BUCKET_NAME=kronosquare

BUYER_COMMISSION_RATE=0.02
PLATFORM_COMMISSION_RATE=0.02
PAYOUT_HOLD_DAYS=7

GST_RATE=18
SELLER_GST_THRESHOLD=200000

TRACKINGMORE_API_KEY=<from trackingmore>
TRACKING_WEBHOOK_SECRET=krono_square
```

> Generate JWT secrets with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

## 4. Enable Public Networking

1. Go to your service → **Settings** → **Networking**
2. Click **Generate Domain** under Public Networking
3. You get a URL like: `https://kronosquare-be.up.railway.app`
4. (Optional) Add a custom domain: `api.kronosquare.in`

## 5. Verify Deployment

1. Check **Deployments** tab — green = success
2. Check **Logs** tab — you should see your server startup message
3. Test the health endpoint:
   ```
   GET https://kronosquare-be.up.railway.app/api/health
   ```

## 6. Configure TrackingMore Webhook

Once deployed, set your webhook URL in TrackingMore dashboard:
```
https://kronosquare-be.up.railway.app/api/tracking/webhook
```

## Useful Railway Commands (optional CLI)

```bash
npm install -g @railway/cli
railway login
railway link          # link local project to Railway
railway logs          # stream live logs
railway variables     # view env vars
```

## Cost

| Plan | Price | What you get |
|---|---|---|
| Starter | $5/mo | 512MB RAM, 1 vCPU, always-on |
| Pro | $20/mo | More resources, static IP |

Starter is sufficient until you have meaningful traffic.
