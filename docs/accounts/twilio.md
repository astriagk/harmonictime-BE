# Twilio — Account Setup Guide

Used for: sending OTP SMS messages for phone-based password reset.  
**Free trial available** — comes with a small credit balance, enough for development and testing.

---

## Step 1 — Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up with your email
3. Verify your email address
4. Verify your phone number (Twilio calls or texts you a code)
5. Answer the onboarding questions (can be anything — e.g. "Send SMS", "Node.js")

---

## Step 2 — Get Your Account Credentials

1. Log in to the Twilio Console at [https://console.twilio.com](https://console.twilio.com)
2. On the dashboard you'll see:
   - **Account SID** — starts with `AC...`
   - **Auth Token** — click the eye icon to reveal it
3. Copy both

---

## Step 3 — Get a Twilio Phone Number

The app uses two methods for SMS:
- **Direct SMS** via `sendSMS()` — requires a Twilio phone number as the sender
- **Verify OTP** via Twilio Verify — uses a Verify Service (no phone number needed for this)

For direct SMS:

1. In the Twilio Console, go to **Phone Numbers → Manage → Buy a number**
2. Filter by country (choose **India** for `+91` numbers or **US** for a +1 number)
3. Make sure **SMS** capability is checked
4. Click **Buy** (free trial credit covers this)
5. Copy the phone number in E.164 format (e.g. `+12015551234`)

> If you're only using the Verify service (OTP flow) you can skip this step — `TWILIO_PHONE_NUMBER` isn't used for OTPs.

---

## Step 4 — Create a Verify Service (for OTP)

The OTP flow uses Twilio Verify — a managed service that handles code generation and verification.

1. In the Twilio Console go to **Verify → Services**
2. Click **"Create new Service"**
3. Give it a friendly name (e.g. `krono-square`)
4. Click **"Create"**
5. You'll land on the service settings page — copy the **Service SID** (starts with `VA...`)

---

## Step 5 — Set Environment Variables

Add these to your `.env` file:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> `TWILIO_PHONE_NUMBER` is defined in `env.ts` but not currently used — the OTP flow goes through Verify, not direct SMS. Only add it if you use `sendSMS()` directly.

- `TWILIO_ACCOUNT_SID` — from Step 2
- `TWILIO_AUTH_TOKEN` — from Step 2
- `TWILIO_VERIFY_SERVICE_SID` — the Verify Service SID from Step 4

---

## Step 6 — Test OTP (Phone Password Reset)

**1. Request an OTP via phone**

```
POST http://localhost:5000/api/auth/verify-phone
Content-Type: application/json

{
  "phone": "+919876543210",
  "countryCode": "+91"
}
```

Twilio sends an SMS to that number. Response is always a generic success message (to prevent phone enumeration).

**2. Submit the OTP**

```
POST http://localhost:5000/api/auth/reset-password
Content-Type: application/json

{
  "token": "<reset_token_from_step_1_response>",
  "otp": "123456",
  "newPassword": "NewPassword123!"
}
```

---

## Trial Account Limitations

On the free trial:
- You can only send SMS to **verified phone numbers** (numbers you've added to your Twilio Verified Caller IDs)
- All outgoing SMS include the prefix: `"Sent from your Twilio trial account"`

To verify a number for testing:
1. Console → **Phone Numbers → Verified Caller IDs**
2. Click **"Add a new Caller ID"** and verify your test phone number

Once you upgrade to a paid account, you can send to any number without restrictions.

---

## Upgrading to Paid

1. In the Console go to **Billing → Upgrade**
2. Add a payment method
3. Your existing credentials (`ACCOUNT_SID`, `AUTH_TOKEN`, `VERIFY_SERVICE_SID`) stay the same — no env changes needed

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `20003: Authenticate` error | Wrong `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` |
| `21608: Unverified number` | Trial account — add the recipient's number to Verified Caller IDs |
| `60200: Invalid parameter` on Verify | Wrong `TWILIO_VERIFY_SERVICE_SID` |
| OTP not arriving | Phone number must be in E.164 format (`+91...`) — check the `phone` field |
| `verifyMobileOTP` returns `false` | Code expired (10 min TTL) or wrong code entered |
| `TWILIO_PHONE_NUMBER not set` warning | Only needed for `sendSMS()` direct sends, not for OTP Verify flow |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/sms.service.ts` | `sendSMS()`, `sendMobileOTP()`, `verifyMobileOTP()` |
| `src/modules/auth/auth.controller.ts` | `verifyPhone` handler — triggers OTP send |
| `src/modules/auth/auth.routes.ts` | Route: `POST /verify-phone` |
| `src/shared/config/env.ts` | Env var definitions |
