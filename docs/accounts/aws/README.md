# AWS Setup — Index

The app uses one AWS account for three things:

- **S3** — storing product images, GST documents, and site content (like the email logo).
- **SES** — sending all application email (OTPs, order updates, contact form, etc.) over HTTPS, because the deploy host blocks outbound SMTP.
- **SNS** — sending phone-verification OTPs over SMS. Replaces Twilio.

SES and SNS reuse the **same IAM user / access keys** as S3 (`STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`) — there are no separate email or SMS credentials. The only difference between environments is the **verified sending domain** and which `.env` file holds the values.

## Guides

| Guide | What it covers | Target file |
|-------|----------------|-------------|
| [s3-setup.md](s3-setup.md) | Create the AWS account, S3 bucket, and IAM user; wire up `STORAGE_*` | `.env` / `.env.prod` |
| [ses-dev.md](ses-dev.md) | Verify the **dev** sending domain (`astriagk.com`) and send test email | `.env` |
| [ses-prod.md](ses-prod.md) | Verify the **prod** sending domain (`krono2.com`) and grant the prod IAM user SES access | `.env.prod` |
| [sns-sms.md](sns-sms.md) | SMS / mobile OTP via SNS. **Part A** works today (~30 min, no DLT); **Part B** is production access | `.env` / `.env.prod` |

## Environment summary

| | Dev (`.env`) | Prod (`.env.prod`) |
|---|---|---|
| S3 bucket | `harmonic-time` | `kronosquare` |
| IAM user (access key) | `AKIAWNLFXE5WQIK7DGFH` | `AKIAWNLFXE5WRTC4KGVH` (`kronosquare-app`) |
| SES sending domain | `krono2.com` | `krono2.com` |
| `EMAIL_FROM` | `support@krono2.com` | `support@krono2.com` |
| `SES_REGION` | `us-east-1` | `us-east-1` |
| `SMS_REGION` | `ap-south-1` | `ap-south-1` |

> **SMS uses a different region than S3/SES.** Since 30 Apr 2025 AWS only routes India local SMS through `ap-south-1` (Mumbai) or `ap-south-2` (Hyderabad). Sending from `us-east-1` falls back to the international route — pricier and heavily filtered by Indian carriers. See [sns-sms.md](sns-sms.md).

> Each environment sends from its **own** verified domain. An identity verified for one domain/region does **not** let you send from another — that's the `AccessDeniedException ... not authorized to perform ses:SendEmail on resource .../identity/<domain>` error. See [ses-prod.md](ses-prod.md).

## Code references

| File | Purpose |
|------|---------|
| `src/shared/services/file-storage.service.ts` | `uploadFile()` / `deleteFile()` — S3 SDK wrappers |
| `src/shared/services/email.service.ts` | `sendEmail()` / `sendTemplateEmail()` — SES SDK wrapper |
| `src/shared/services/sms.service.ts` | `sendSMS()` / `sendMobileOTP()` / `sendPasswordResetSMS()` — SNS SDK wrapper |
| `src/shared/config/env.ts` | Env var definitions (S3 + SES + SMS) |
