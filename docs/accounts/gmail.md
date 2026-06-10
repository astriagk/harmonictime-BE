# Gmail SMTP — Account Setup Guide

Used for: sending transactional emails — email verification, password reset OTPs, order confirmations, contact form replies, and account status notifications.  
**Free.** No third-party email provider needed — just a Gmail account with an app password.

---

## Step 1 — Use an Existing Gmail Account (or Create One)

You need a Gmail account dedicated to sending app emails. Don't use your personal Gmail — use or create one like:
- `harmonictime.noreply@gmail.com`
- `mail.harmonictime@gmail.com`

Go to [https://accounts.google.com](https://accounts.google.com) to create it if needed.

---

## Step 2 — Enable 2-Factor Authentication

App passwords require 2FA to be active on the account.

1. Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Under **"How you sign in to Google"** click **2-Step Verification**
3. Follow the prompts to turn it on (phone or authenticator app)

---

## Step 3 — Generate an App Password

1. Go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (If you don't see this option, 2FA isn't enabled — do Step 2 first)
2. Under **"App name"** type a name like `harmonic-time-server`
3. Click **"Create"**
4. Google shows a 16-character password like `xxxx xxxx xxxx xxxx`
5. **Copy it** — it's shown only once

> The app password is separate from your Gmail password. Even if it leaks, an attacker can only send email — not access your Google account.

---

## Step 4 — Set Environment Variables

Add these to your `.env` file:

```env
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
CONTACT_RECIPIENT=your_gmail_address@gmail.com
```

- `EMAIL_USER` — the full Gmail address (both sender and auth username)
- `EMAIL_PASS` — the 16-character app password from Step 3 (spaces are fine — the app strips them automatically)
- `CONTACT_RECIPIENT` — where contact form submissions are forwarded; usually the same as `EMAIL_USER`

**Optional env vars:**

```env
LOGO_URL=https://your-bucket.s3.region.amazonaws.com/site-content/email_logo/your-logo-file
FRONTEND_URL=https://your-frontend-domain.com
```

- `LOGO_URL` — publicly reachable image URL shown in email headers; falls back to text wordmark if empty
- `FRONTEND_URL` — used to build links in emails (e.g. "Verify your email" button URL)

---

## Step 5 — Test the Email Service

Start the server and trigger a registration to send a verification email:

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test1234!",
  "acceptedTerms": true,
  "accountType": "individual"
}
```

Check the inbox of `test@example.com` — you should receive a "Verify your Harmonic Time email address" email within a few seconds.

If you don't receive it, check the server logs for `Failed to send email:` errors.

---

## Emails Sent by the App

| Trigger | Subject |
|---------|---------|
| New registration | "Verify your Harmonic Time email address" |
| Resend verification | "Verify your Harmonic Time email address" |
| Password reset (email OTP) | "Reset your Harmonic Time password" |
| Order confirmed (buyer) | Order confirmation with itemised summary |
| Admin blocks account | Account blocked notification |
| Admin suspends account | Account suspended notification |
| Admin restores account | Account restored notification |

---

## SMTP Configuration (for reference)

The app connects to Gmail using these settings (hardcoded in `email.service.ts`):

| Setting | Value |
|---------|-------|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Security | STARTTLS |
| Auth | Username + App Password |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Invalid login` / `Username and Password not accepted` | App password is wrong, or 2FA isn't enabled — regenerate the app password |
| `Failed to send email` in logs but no error in response | Email sending is fire-and-forget; check logs for the actual SMTP error |
| Email not arriving | Check spam folder; Gmail may throttle if you send too many too fast |
| `ECONNREFUSED` on port 587 | Firewall blocking outbound SMTP — try from a different network or VPS |
| Verification link in email is `localhost:4200` | Set `FRONTEND_URL` in `.env` to your actual frontend domain |
| Email logo not showing | `LOGO_URL` must be a publicly reachable HTTPS URL (S3 link works; `localhost` doesn't) |

---

## Daily Sending Limits

Gmail SMTP via app password allows approximately **500 emails/day**. For early development and testing this is more than enough. For high-volume production (order confirmations at scale), switch to a transactional email provider like **Resend**, **SendGrid**, or **AWS SES** — only `email.service.ts` needs to change.

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/email.service.ts` | `sendEmail()` and `sendTemplateEmail()` — nodemailer transporter |
| `src/shared/email-templates/index.ts` | All email template definitions (subject + text + HTML) |
| `src/modules/auth/auth.controller.ts` | Registration and password-reset email triggers |
| `src/modules/commerce/payment/payment.controller.ts` | Order confirmation email (fire-and-forget after payment verify) |
| `src/modules/support/contact/contact.controller.ts` | Contact form submission email |
| `src/shared/config/env.ts` | Env var definitions |
