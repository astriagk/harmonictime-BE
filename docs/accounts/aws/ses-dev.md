# AWS SES — Email Setup (Dev)

Configures application email for the **development** environment. Dev sends from **`astriagk.com`** and stores its values in **`.env`**.

All email is sent through **Amazon SES** over HTTPS (port 443) — the deploy host blocks outbound SMTP, so SES is the only channel. There is **no SMTP fallback**: if `EMAIL_FROM` is blank, every send fails (the app logs a warning at startup).

> Prerequisite: the S3 IAM user from [s3-setup.md](s3-setup.md) Step 4. SES reuses those same `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` — no separate email credentials.

**SES pricing:** ~$0.10 per 1,000 emails (no perpetual free tier on new accounts).

---

## Step 1 — Open Amazon SES

1. AWS Console search bar → type **SES** → open **Amazon Simple Email Service**
2. In the top-right region selector, choose **`us-east-1` (N. Virginia)**
3. This must match `SES_REGION` in `.env`

> Verify your domain (Step 2) in the **same region** you send from. An identity verified in `us-east-1` does **not** work when sending from another region.

---

## Step 2 — Verify the Dev Sending Domain (`astriagk.com`)

1. SES → **Configuration → Identities → Create identity**
2. Choose **Domain**, enter `astriagk.com`
3. Leave **Easy DKIM** enabled (RSA 2048-bit) → **Create identity**
4. SES shows a set of **CNAME records** (3 for DKIM) — keep this page open
5. In a new tab: **GoDaddy → My Products → Domain → DNS → Manage DNS**
6. For each CNAME SES listed, click **Add Record** in GoDaddy:

   | Field | Value |
   |-------|-------|
   | **Type** | `CNAME` |
   | **Name/Host** | the SES-provided name (strip the trailing `.astriagk.com` — GoDaddy appends it) |
   | **Value/Points to** | the SES-provided value |
   | **TTL** | 1 hour (default) |

7. Save. Verification completes once DNS propagates (minutes to hours); the identity flips to **Verified**.

> **Tip:** if SES suggests an SPF record (TXT like `v=spf1 include:amazonses.com ~all`), add it for best inbox placement.

---

## Step 3 — Grant the IAM User SES Permission

The dev IAM user (behind `STORAGE_ACCESS_KEY` in `.env`) needs `ses:SendEmail`. Without it, every send fails with:

```
AccessDeniedException: User arn:aws:iam::<account-id>:user/<user> is not
authorized to perform `ses:SendEmail' on resource `...identity/astriagk.com'
```

1. IAM → **Users → select the dev user** → **Add permissions → Attach policies directly**
2. Attach **`AmazonSESFullAccess`** → **Next → Add permissions**
3. AWS-side change — **no redeploy needed**. Retry the send.

> **Least-privilege alternative** (IAM → user → **Add permissions → Create inline policy → JSON**):
>
> ```json
> {
>   "Version": "2012-10-17",
>   "Statement": [
>     { "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }
>   ]
> }
> ```

---

## Step 4 — Sandbox (Dev Testing)

New SES accounts start in the **sandbox**: max **200 emails/day**, 1 email/sec, and you can only send **to verified addresses**. This is usually fine for dev.

To send test email to a personal inbox while in sandbox:

1. SES → **Identities → Create identity → Email address** → verify your address
2. Send to that verified address from the app

Leaving the sandbox is a prod concern — see [ses-prod.md](ses-prod.md) Step 4.

---

## Step 5 — Set Email Environment Variables (`.env`)

```env
EMAIL_FROM=support@astriagk.com
SES_REGION=us-east-1
CONTACT_RECIPIENT=kronosqu2@gmail.com
```

- `EMAIL_FROM` — an address on the **verified** domain from Step 2. Required; if blank, all sends fail.
- `SES_REGION` — must match Step 1. Defaults to `STORAGE_REGION` if unset.
- `CONTACT_RECIPIENT` — where contact-form submissions go (defaults to `EMAIL_FROM`).
- Credentials are **not** separate — SES reuses `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.

On server start you should see:

```
Email transport: Amazon SES (us-east-1) from support@astriagk.com
```

Trigger any email (e.g. sign up for an OTP). Success returns no error; failures log as `Failed to send email: ...`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Email address is not verified` | `EMAIL_FROM` isn't on a verified domain, or sandbox + unverified recipient (Steps 2, 4) |
| Startup warns "EMAIL_FROM is not set" | `EMAIL_FROM` is blank — set it (Step 5). There is no SMTP fallback |
| `AccessDenied` / `not authorized to perform ses:SendEmail` | IAM user missing SES permission (Step 3) |
| `MessageRejected` | Domain not verified, or still in sandbox — check Identities status |
| Wrong region / identity not found | `SES_REGION` doesn't match the region where you verified the domain (Step 1) |

---

Related: [s3-setup.md](s3-setup.md) · [ses-prod.md](ses-prod.md) · back to [README](README.md)
