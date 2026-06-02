# Harmonic Time — Backend API

TypeScript + Node.js + Express + MongoDB e-commerce API.

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Run in development
npm run dev

# Build for production
npm run build
npm start
```

---

## Environment Variables

All variables are defined in `src/shared/config/env.ts`.  
Copy `.env.example` to `.env` and fill in each value before running.

Key groups:

| Group | Variables |
|-------|-----------|
| Server | `PORT`, `MONGO_URI`, `DB_NAME` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Email | `EMAIL_USER`, `EMAIL_PASS`, `CONTACT_RECIPIENT` |
| SMS / OTP | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_SERVICE_SID` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_ACCOUNT_NUMBER` |
| File Storage | `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_NAME` |
| Tracking | `TRACKINGMORE_API_KEY`, `TRACKING_WEBHOOK_SECRET` |
| Business | `BUYER_COMMISSION_RATE`, `PLATFORM_COMMISSION_RATE`, `PAYOUT_HOLD_DAYS`, `GST_RATE`, `SELLER_GST_THRESHOLD` |

---

## Third-Party Account Setup Guides

Step-by-step instructions for creating and configuring each external service are in:

```
docs/accounts/
```

| Service | Guide | What it's used for |
|---------|-------|--------------------|
| TrackingMore | [docs/accounts/trackingmore.md](docs/accounts/trackingmore.md) | Live package tracking, delivery webhooks (free plan) |

> Add a new file to `docs/accounts/` whenever a new external service is integrated.

---

## Project Structure

```
src/
  modules/          # Feature modules (auth, commerce, users, wallet, etc.)
  shared/
    config/         # env.ts, database.ts, razorpay.ts
    constants/      # roles, HTTP status, collection names
    middlewares/    # auth, validation, error handling
    services/       # email, SMS, file storage, tracking
    utils/          # apiError, apiResponse helpers
spec/               # Architecture and folder structure docs
docs/
  accounts/         # Step-by-step account setup guides
```

See [spec/Architecture.md](spec/Architecture.md) and [spec/FolderStructure.md](spec/FolderStructure.md) for deeper docs.

---

## API Route Groups

| Prefix | Access | Purpose |
|--------|--------|---------|
| `/api/auth` | Public | Register, login, OTP, token refresh |
| `/api/public` | Public | Catalog, product listings, reviews |
| `/api/customer/*` | Buyer JWT | Cart, wishlist, checkout, orders |
| `/api/seller/*` | Seller JWT | Shipments, earnings, withdrawals |
| `/api/admin/*` | Admin JWT | User management, platform settings |
