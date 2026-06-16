# AWS Setup — Index

The app uses one AWS account for two things:

- **S3** — storing product images, GST documents, and site content (like the email logo).
- **SES** — sending all application email (OTPs, order updates, contact form, etc.) over HTTPS, because the deploy host blocks outbound SMTP.

SES reuses the **same IAM user / access keys** as S3 (`STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`) — there are no separate email credentials. The only difference between environments is the **verified sending domain** and which `.env` file holds the values.

## Guides

| Guide | What it covers | Target file |
|-------|----------------|-------------|
| [s3-setup.md](s3-setup.md) | Create the AWS account, S3 bucket, and IAM user; wire up `STORAGE_*` | `.env` / `.env.prod` |
| [ses-dev.md](ses-dev.md) | Verify the **dev** sending domain (`astriagk.com`) and send test email | `.env` |
| [ses-prod.md](ses-prod.md) | Verify the **prod** sending domain (`krono2.com`) and grant the prod IAM user SES access | `.env.prod` |

## Environment summary

| | Dev (`.env`) | Prod (`.env.prod`) |
|---|---|---|
| S3 bucket | `harmonic-time` | `kronosquare` |
| IAM user (access key) | `AKIAWNLFXE5WQIK7DGFH` | `AKIAWNLFXE5WRTC4KGVH` (`kronosquare-app`) |
| SES sending domain | `astriagk.com` | `krono2.com` |
| `EMAIL_FROM` | `support@astriagk.com` | `support@krono2.com` |
| `SES_REGION` | `us-east-1` | `us-east-1` |

> Each environment sends from its **own** verified domain. An identity verified for one domain/region does **not** let you send from another — that's the `AccessDeniedException ... not authorized to perform ses:SendEmail on resource .../identity/<domain>` error. See [ses-prod.md](ses-prod.md).

## Code references

| File | Purpose |
|------|---------|
| `src/shared/services/file-storage.service.ts` | `uploadFile()` / `deleteFile()` — S3 SDK wrappers |
| `src/shared/services/email.service.ts` | `sendEmail()` / `sendTemplateEmail()` — SES SDK wrapper |
| `src/shared/config/env.ts` | Env var definitions (S3 + SES) |
