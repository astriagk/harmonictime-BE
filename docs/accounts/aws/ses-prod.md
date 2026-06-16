# AWS SES — Email Setup (Prod)

Configures application email for the **production** environment. Prod sends from **`krono2.com`** and stores its values in **`.env.prod`**.

This is a **second, separate sending identity** from dev. Dev's `astriagk.com` identity does **not** authorize sending from `krono2.com` — sending from the wrong domain is exactly the error you hit:

```
AccessDeniedException: User `arn:aws:iam::440984348525:user/kronosquare-app' is not
authorized to perform `ses:SendEmail' on resource `...identity/astriagk.com'
```

The prod IAM user `kronosquare-app` can only send from a domain it (a) is permitted for and (b) that is verified. So for prod you must **verify `krono2.com`** and point `EMAIL_FROM` at it.

> Prerequisite: the prod S3 bucket + IAM user from [s3-setup.md](s3-setup.md). SES reuses the prod `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` already in `.env.prod` — no separate email credentials.

---

## Step 1 — Open Amazon SES (same region as dev)

1. AWS Console → **SES → Amazon Simple Email Service**
2. Region selector → **`us-east-1` (N. Virginia)** — must match `SES_REGION` in `.env.prod`

> Both dev and prod send from `us-east-1`; you'll just have two domain identities verified in that one region (`astriagk.com` and `krono2.com`).

---

## Step 2 — Verify the Prod Sending Domain (`krono2.com`)

This is the "get one more" identity — repeat the domain-verification flow for `krono2.com`.

1. SES → **Configuration → Identities → Create identity**
2. Choose **Domain**, enter `krono2.com`
3. Leave **Easy DKIM** enabled (RSA 2048-bit) → **Create identity**
4. SES shows **3 CNAME records** for DKIM — keep this page open
5. New tab: **GoDaddy → My Products → `krono2.com` → DNS → Manage DNS**
6. For each CNAME SES listed, **Add Record** in GoDaddy:

   | Field | Value |
   |-------|-------|
   | **Type** | `CNAME` |
   | **Name/Host** | the SES-provided name (strip the trailing `.krono2.com` — GoDaddy appends it) |
   | **Value/Points to** | the SES-provided value |
   | **TTL** | 1 hour (default) |

7. Save. The identity flips to **Verified** once DNS propagates (minutes to hours).

> **Tip:** add the SPF TXT record (`v=spf1 include:amazonses.com ~all`) on `krono2.com` for deliverability.

---

## Step 3 — Grant the Prod IAM User SES Permission on `krono2.com`

The prod IAM user `kronosquare-app` needs `ses:SendEmail`. If it already has `AmazonSESFullAccess` (from S3 Step 4) it can send from any verified identity in the account — so once Step 2 is **Verified**, the original error clears.

If you used a **least-privilege** policy scoped to a specific identity, widen it to include `krono2.com`:

1. IAM → **Users → `kronosquare-app` → Add permissions → Attach policies directly**
2. Attach **`AmazonSESFullAccess`**, **or** edit the inline policy to allow the new identity:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ses:SendEmail", "ses:SendRawEmail"],
         "Resource": "arn:aws:ses:us-east-1:440984348525:identity/krono2.com"
       }
     ]
   }
   ```
   (or use `"Resource": "*"` to allow any verified identity)

3. AWS-side change — **no redeploy needed**.

---

## Step 4 — Request Production Access (Leave the Sandbox)

Prod must send to **real users**, so it cannot stay in the sandbox (200/day, verified recipients only).

1. SES → **Account dashboard** → **"Request production access"**
2. Choose **Transactional**, fill in the website URL and a short description (OTPs, order updates, etc.)
3. Submit — approval is usually within 24 hours

> Until approved, sends only reach verified addresses. `CONTACT_RECIPIENT=kronosqu2@gmail.com` must be verified while in sandbox.

---

## Step 5 — Set Email Environment Variables (`.env.prod`)

```env
EMAIL_FROM=support@krono2.com
SES_REGION=us-east-1
CONTACT_RECIPIENT=kronosqu2@gmail.com
```

- `EMAIL_FROM` — an address on the **verified** `krono2.com` domain (Step 2). This is the change that fixes the `AccessDeniedException`.
- `SES_REGION` — must match Step 1.
- Credentials are **not** separate — SES reuses the prod `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.

On prod start you should see:

```
Email transport: Amazon SES (us-east-1) from support@krono2.com
```

---

## Checklist — fixing the `AccessDeniedException`

- [ ] `krono2.com` identity created in SES `us-east-1` and status **Verified**
- [ ] `kronosquare-app` IAM user allows `ses:SendEmail` on `identity/krono2.com` (or `*`)
- [ ] `.env.prod` → `EMAIL_FROM=support@krono2.com`
- [ ] If still in sandbox: recipient address verified, or production access approved
- [ ] Restart prod and confirm the startup log shows `from support@krono2.com`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `not authorized to perform ses:SendEmail on resource .../identity/astriagk.com` | `EMAIL_FROM` still points at the dev domain — set it to `support@krono2.com` (Step 5) |
| `not authorized ... identity/krono2.com` | IAM user lacks permission on the new identity (Step 3) |
| `Email address is not verified` / `MessageRejected` | `krono2.com` not yet Verified, or still in sandbox (Steps 2, 4) |
| Wrong region / identity not found | `SES_REGION` ≠ the region where `krono2.com` was verified (Step 1) |

---

Related: [s3-setup.md](s3-setup.md) · [ses-dev.md](ses-dev.md) · back to [README](README.md)
