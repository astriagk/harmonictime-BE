# Third-Party Services Setup

All services below are already integrated in the backend. This doc covers the
production configuration steps for each one.

---

## AWS S3 — File Storage

Your backend uses S3 for storing seller documents, product images, and other uploads.

### IAM User (Least Privilege)

Instead of using root credentials, create a dedicated IAM user:

1. AWS Console → **IAM** → **Users** → **Create user**
2. Name: `kronosquare-api`
3. Attach policy: **AmazonS3FullAccess** (or create a scoped policy for your bucket only)
4. Go to the user → **Security credentials** → **Create access key**
5. Choose: **Application running outside AWS** → copy the key ID and secret

Set in Railway:
```
STORAGE_ACCESS_KEY=<key id>
STORAGE_SECRET_KEY=<secret>
STORAGE_REGION=us-east-1
STORAGE_BUCKET_NAME=kronosquare
```

### Bucket CORS (Required for browser uploads)

In your S3 bucket → **Permissions** → **CORS configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "https://krono-square.pages.dev",
      "https://krono-square.vercel.app",
      "https://kronosquare.in"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Estimated Cost

| Usage | Cost |
|---|---|
| Storage (first 5 GB) | $0.023/GB/month |
| PUT / COPY / POST requests | $0.005 per 1,000 |
| GET requests | $0.0004 per 1,000 |
| Data transfer out | $0.09/GB |
| **Typical early stage (5GB, light traffic)** | **~$1–3/month** |

---

## Twilio — OTP Verification

Used for phone number verification during signup and sensitive actions.

### Setup

1. Log in at https://console.twilio.com
2. **Verify** → **Services** → **Create new Service**
3. Name: `Krono Square` → copy the **Service SID**
4. Go to account dashboard → copy **Account SID** and **Auth Token**

Set in Railway:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<auth token>
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Cost

| Action | Cost |
|---|---|
| OTP sent via SMS (India) | ~$0.05 per verification |
| 100 OTPs/month | ~$5 |
| 300 OTPs/month | ~$15 |

> To reduce cost: add email OTP as a fallback for non-critical flows (password reset, etc.).

---

## Razorpay — Payments

Indian payment gateway. No monthly fees — pay per transaction.

### Setup

1. Log in at https://dashboard.razorpay.com
2. Go to **Settings** → **API Keys** → **Generate Key** (Live mode)
3. Copy **Key ID** and **Key Secret**

For penny-drop bank verification:
1. Activate **Razorpay X** (current account)
2. Enable **Fund Account Validation** in Razorpay X dashboard
3. Get your Razorpay X current account number

Set in Railway:
```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_ACCOUNT_NUMBER=<razorpay x account number>
```

### Cost

| Transaction type | Fee |
|---|---|
| Domestic cards / UPI / Netbanking | 2% + GST |
| International cards | 3% + GST |
| No monthly fee | $0 |

---

## TrackingMore — Shipment Tracking

Used to fetch live courier scan events for Delhivery, BlueDart, DTDC, Ekart, etc.

### Setup

1. Sign up at https://www.trackingmore.com
2. Go to **API** → copy your **API Key**
3. Go to **Webhooks** → **Add Webhook**:
   - URL: `https://kronosquare-be.up.railway.app/api/tracking/webhook`
   - Events: select all shipment status events
   - Secret: use the same random string you set as `TRACKING_WEBHOOK_SECRET`

Set in Railway:
```
TRACKINGMORE_API_KEY=<api key>
TRACKING_WEBHOOK_SECRET=krono_square
```

### Free Plan Limits

| Limit | Value |
|---|---|
| Trackings/month | 50 |
| Couriers supported | 1,000+ |
| Webhook events | Included |

Upgrade to **Basic ($9/mo, 200 trackings)** when you're processing more than 50 orders/month.

---

## ImgBB — Image Hosting

Used for hosting product and seller images publicly.

### Setup

1. Sign up at https://imgbb.com
2. Go to **API** → copy your **API Key**

Set in Railway:
```
IMGBB_API_KEY=<api key>
```

### Cost

Free — unlimited uploads, 32MB max per image. No paid plans needed at early stage.

---

## Domain & DNS

### Recommended Registrars (India)

| Registrar | .in price | .com price |
|---|---|---|
| GoDaddy | ~₹800/yr | ~₹850/yr |
| Namecheap | ~₹750/yr | ~₹950/yr |
| Cloudflare Registrar | At cost | ~$10/yr |

### Recommended DNS Setup

Point your domain DNS to Cloudflare (free) for the best performance and DDoS protection.

| Record | Type | Value |
|---|---|---|
| `www` | CNAME | `krono-square.pages.dev` (Angular) |
| `app` | CNAME | `krono-square.vercel.app` (Next.js) |
| `api` | CNAME | `kronosquare-be.up.railway.app` (Backend) |
