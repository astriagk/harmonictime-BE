# Razorpay — Account Setup Guide

Used for: collecting buyer payments (checkout flow) and penny-drop bank account verification (seller payouts).  
**Test mode is available for free** — no real money moves during development.

---

## Step 1 — Create a Razorpay Account

1. Go to [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup)
2. Sign up with your business email
3. Verify your email address
4. Complete the basic business profile (can use placeholder info for dev)

---

## Step 2 — Get Test API Keys

1. Log in to the dashboard
2. In the top-left, make sure the toggle is set to **"Test Mode"** (not "Live Mode")
3. Go to **Settings → API Keys**
4. Click **"Generate Test Key"**
5. A modal shows your **Key ID** and **Key Secret** — copy both immediately
   - Key ID starts with `rzp_test_...`
   - Key Secret is shown only once — if you miss it, regenerate

---

## Step 3 — Set Up Razorpay X (for Bank Verification)

Razorpay X is used for the penny-drop bank account verification feature (sellers add their bank account, we send ₹1 to verify it's real).

1. In the dashboard, switch to **"Razorpay X"** (the banking product, separate from the payments product)
2. Go to **Fund Account Validation** → **Enable**
3. You'll need an active Razorpay X Current Account — note down the **account number**

> For development, use the test account number from your test Razorpay X dashboard. Penny-drop in test mode doesn't charge anything.

---

## Step 4 — Set Environment Variables

Add these to your `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_ACCOUNT_NUMBER=your_razorpay_x_account_number
```

- `RAZORPAY_KEY_ID` — from Step 2 (starts with `rzp_test_` in test mode, `rzp_live_` in production)
- `RAZORPAY_KEY_SECRET` — from Step 2
- `RAZORPAY_ACCOUNT_NUMBER` — your Razorpay X current account number (for penny-drop)

---

## Step 5 — Test Payments (Test Mode)

In test mode, use Razorpay's test card details — no real card needed.

### Test card numbers

| Card | Number | CVV | Expiry |
|------|--------|-----|--------|
| Visa (success) | `4111 1111 1111 1111` | Any 3 digits | Any future date |
| Mastercard (success) | `5267 3181 8797 5449` | Any 3 digits | Any future date |
| Card that fails | `4000 0000 0000 0002` | Any | Any future date |

### Test UPI
Use `success@razorpay` as the UPI ID — payment always succeeds.  
Use `failure@razorpay` — payment always fails.

### Test flow (Postman + frontend)

**1. Create a Razorpay order**
```
POST http://localhost:5000/api/payments/create
Authorization: Bearer <buyer_token>
Content-Type: application/json

{
  "CartItemIDs": ["<cart_item_id>"],
  "AddressID": "<address_id>"
}
```

Response includes `razorpayOrderId` and `amount`.

**2. Simulate payment capture (bypass frontend)**
```
POST http://localhost:5000/api/payments/verify
Authorization: Bearer <buyer_token>
Content-Type: application/json

{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_test_dummy",
  "razorpaySignature": "dummy_sig",
  "AddressID": "<address_id>"
}
```

> In actual use the frontend calls the Razorpay JS SDK which handles the payment UI and returns the real `paymentId` and `signature` for verification.

---

## Step 6 — Go Live (Production)

1. Complete KYC in the Razorpay dashboard (business registration, bank account, PAN)
2. Once approved, go to **Settings → API Keys → Live Mode**
3. Generate live keys — they start with `rzp_live_...`
4. Replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in production `.env`

> Never put live keys in `.env` committed to git. Use environment secrets in your hosting platform.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Bad Request: key_id is required` | `RAZORPAY_KEY_ID` missing or empty in `.env` |
| `Signature mismatch` on verify | `RAZORPAY_KEY_SECRET` is wrong |
| `Order not found` | `razorpayOrderId` passed to verify doesn't match what was created |
| Penny-drop failing | `RAZORPAY_ACCOUNT_NUMBER` wrong, or Fund Account Validation not enabled in Razorpay X |
| `Payment failed` with test card | Use a different test card — some are intentionally configured to fail |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/config/razorpay.ts` | Razorpay SDK client initialisation |
| `src/modules/commerce/payment/payment.controller.ts` | `createPaymentOrder` and `verifyPayment` handlers |
| `src/modules/commerce/payment/payment.routes.ts` | Routes: `POST /create` and `POST /verify` |
| `src/modules/wallet/bank_account/bank_account.controller.ts` | Penny-drop bank verification |
| `src/shared/config/env.ts` | Env var definitions |
