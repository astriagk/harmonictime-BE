# Environment Variables Reference

Complete list of all environment variables used by the backend.
Set all of these in Railway under the **Variables** tab.

## Server

| Variable | Required | Example | Notes |
|---|---|---|---|
| `PORT` | No | `5000` | Railway sets this automatically; you can omit it |

## Database

| Variable | Required | Example | Notes |
|---|---|---|---|
| `MONGO_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/` | Full Atlas connection string |
| `DB_NAME` | No | `kronosquare` | Defaults to `harmoniv_time` if unset — set explicitly |

## Authentication

| Variable | Required | Example | Notes |
|---|---|---|---|
| `JWT_SECRET` | Yes | 64-char hex string | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | `15d` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | 64-char hex string | Must be different from `JWT_SECRET` |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token lifetime |

## Google Sign-In

| Variable | Required | Example | Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes (for `POST /api/auth/google`) | `1234-abc.apps.googleusercontent.com` | OAuth 2.0 **Web application** client ID from Google Cloud Console → APIs & Services → Credentials. Must be the same id the frontend uses. Public value — no client secret is needed for the ID-token flow |
| `GOOGLE_ADDITIONAL_CLIENT_IDS` | No | `ios-id...,android-id...` | Comma-separated extra accepted `aud` values, for native clients that mint tokens under their own client id |

Add every frontend origin (e.g. `http://localhost:4200` and the production
`FRONTEND_URL`) to **Authorized JavaScript origins** on that OAuth client, or
Google Identity Services will refuse to issue a token to the page.

## Frontend

| Variable | Required | Example | Notes |
|---|---|---|---|
| `FRONTEND_URL` | Yes | `https://krono-square.pages.dev` | Used to build links in emails and set CORS origin |

## Email

| Variable | Required | Example | Notes |
|---|---|---|---|
| `EMAIL_USER` | Yes | `your-brevo-login@email.com` | Brevo SMTP login |
| `EMAIL_PASS` | Yes | `<brevo-smtp-key>` | Brevo SMTP key (not your Brevo account password) |
| `CONTACT_RECIPIENT` | No | `support@kronosquare.in` | Where contact form emails go; falls back to `EMAIL_USER` |
| `LOGO_URL` | No | S3 URL | Public URL for the Krono Square logo shown in email headers |

## SMS / OTP (AWS SNS)

Uses the same `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` as S3 and SES — no separate credentials. Full setup in [docs/accounts/aws/sns-sms.md](../docs/accounts/aws/sns-sms.md).

| Variable | Required | Example | Notes |
|---|---|---|---|
| `SMS_REGION` | No | `ap-south-1` | Defaults to `ap-south-1`. India local routes only work from `ap-south-1` / `ap-south-2` |
| `SMS_SENDER_ID` | Yes (India) | `KRONO2` | Approved sender header, 3–6 letters, case-sensitive |
| `SMS_DLT_ENTITY_ID` | Yes (India) | `1234567890123456789` | TRAI Principal Entity ID |
| `SMS_DLT_TEMPLATE_ID_OTP` | Yes (India) | `9876543210987654321` | DLT template for the phone-verification SMS |
| `SMS_DLT_TEMPLATE_ID_RESET` | Yes (India) | `9876543210987654322` | DLT template for the password-reset SMS |

## Razorpay

| Variable | Required | Example | Notes |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Yes | `rzp_live_xxxxxxxx` | Use `rzp_live_` for production, `rzp_test_` for staging |
| `RAZORPAY_KEY_SECRET` | Yes | `<secret>` | From Razorpay dashboard → Settings → API Keys |
| `RAZORPAY_ACCOUNT_NUMBER` | Yes | `<account>` | Razorpay X current account — needed for penny-drop verification |

## AWS S3

| Variable | Required | Example | Notes |
|---|---|---|---|
| `STORAGE_REGION` | Yes | `us-east-1` | AWS region where your bucket lives |
| `STORAGE_ACCESS_KEY` | Yes | `AKIAxxxxxxxxxxxxxxxx` | IAM user access key |
| `STORAGE_SECRET_KEY` | Yes | `<secret>` | IAM user secret key |
| `STORAGE_BUCKET_NAME` | Yes | `kronosquare` | S3 bucket name |

## ImgBB

| Variable | Required | Example | Notes |
|---|---|---|---|
| `IMGBB_API_KEY` | Yes | `<key>` | From imgbb.com → API section |

## Commission & Business Rules

| Variable | Required | Default | Notes |
|---|---|---|---|
| `BUYER_COMMISSION_RATE` | No | `0.02` | 2% added on top of product price for buyers |
| `PLATFORM_COMMISSION_RATE` | No | `0.02` | 2% deducted from seller's effective sale price |
| `PAYOUT_HOLD_DAYS` | No | `7` | Days after delivery before seller can withdraw |
| `GST_RATE` | No | `18` | GST percentage applied to tax-inclusive prices |
| `SELLER_GST_THRESHOLD` | No | `200000` | Cumulative gross sales (₹) before GST details required |

## Shipment Tracking

| Variable | Required | Example | Notes |
|---|---|---|---|
| `TRACKINGMORE_API_KEY` | Yes | `<key>` | From TrackingMore → API section |
| `TRACKING_WEBHOOK_SECRET` | Yes | `krono_square` | Must match the secret set in TrackingMore webhook settings |

---

## Generating Secure Secrets

Run this locally to generate JWT secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('TRACKING_WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

## Staging vs Production

Use separate Railway projects (or Railway environments) for staging and production.
The key differences between environments:

| Variable | Staging | Production |
|---|---|---|
| `MONGO_URI` | Separate Atlas cluster or DB name | Production Atlas cluster |
| `DB_NAME` | `kronosquare-staging` | `kronosquare` |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` |
| `FRONTEND_URL` | Staging app URL | Production app URL |
| `JWT_SECRET` | Any strong string | Strong unique string |
