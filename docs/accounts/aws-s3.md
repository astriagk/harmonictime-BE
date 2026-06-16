# AWS — Account Setup Guide (S3 + SES)

Used for two things on the same AWS account:
- **S3** — storing product images, GST documents, and site content (like the email logo).
- **SES** — sending all application email (OTPs, order updates, contact form, etc.) over HTTPS, because the deploy host blocks outbound SMTP.

**S3 free tier:** 5 GB storage, 20,000 GET requests, 2,000 PUT requests per month for 12 months.  
**SES pricing:** ~$0.10 per 1,000 emails (no perpetual free tier on new accounts).

> **S3 setup is Steps 1–6.** **SES (email) setup is Steps 7–11.** SES reuses the same IAM user created in Step 4.

---

## Step 1 — Create an AWS Account

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and click **"Create an AWS Account"**
2. Enter your email and choose an account name (e.g. `krono-square`)
3. Provide a credit/debit card — AWS won't charge unless you exceed the free tier
4. Complete identity verification (phone OTP)
5. Choose the **Free** support plan
6. Sign in to the AWS Console

---

## Step 2 — Create an S3 Bucket

1. In the AWS Console search bar, type **S3** and open it
2. Click **"Create bucket"**
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Bucket name** | `kronosquare` (must be globally unique — add a suffix if taken, e.g. `kronosquare-prod`) |
   | **AWS Region** | `eu-north-1` (Stockholm) or `ap-south-1` (Mumbai) for India-based users |
   | **Object Ownership** | ACLs disabled (recommended) |
   | **Block Public Access** | **Uncheck** "Block all public access" — we need files publicly readable |
   | **Versioning** | Disable (not needed) |

4. Click **"Create bucket"**

---

## Step 3 — Make the Bucket Publicly Readable

After creating the bucket:

1. Open the bucket → **Permissions** tab
2. Scroll to **Bucket Policy** → click **Edit**
3. Paste this policy (replace `kronosquare` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::kronosquare/*"
    }
  ]
}
```

4. Click **"Save changes"**

> This allows anyone to **read** files (view images) but only your IAM user (Step 4) can **upload or delete** them.

---

## Step 4 — Create an IAM User for the App

Don't use your root AWS account credentials in `.env`. Create a limited IAM user instead.

1. In the AWS Console, go to **IAM → Users → Create user**
2. Username: `kronosquare-app`
3. Click **"Next"** (skip "Add to group" for now)
4. On the **"Set permissions"** page → choose **"Attach policies directly"**
5. Search for and attach **`AmazonS3FullAccess`** — and, since this same user also sends email, attach **`AmazonSESFullAccess`** too (see Step 10)

   > For tighter security in production, create a custom policy that only allows `s3:PutObject` + `s3:DeleteObject` on your bucket and `ses:SendEmail` + `ses:SendRawEmail`.

6. Click **"Create user"**
7. Open the user you just created → **Security credentials** tab
8. Under **Access keys** → click **"Create access key"**
9. Choose **"Application running outside AWS"**
10. Click **"Create access key"**
11. **Copy both the Access Key ID and Secret Access Key** — the secret is shown only once

---

## Step 5 — Set Environment Variables

Add these to your `.env` file:

```env
STORAGE_REGION=eu-north-1
STORAGE_ACCESS_KEY=your_access_key_id
STORAGE_SECRET_KEY=your_secret_access_key
STORAGE_BUCKET_NAME=kronosquare
```

- `STORAGE_REGION` — must match the region you chose in Step 2
- `STORAGE_ACCESS_KEY` — the Access Key ID from Step 4
- `STORAGE_SECRET_KEY` — the Secret Access Key from Step 4
- `STORAGE_BUCKET_NAME` — the exact bucket name from Step 2

---

## Step 6 — Test the Upload

Start the server and try uploading a product image via the API:

```
POST http://localhost:5000/api/products/:productId/images
Authorization: Bearer <seller_token>
Content-Type: multipart/form-data

file: [attach any image file]
```

The response should include a URL in the format:
```
https://kronosquare.s3.eu-north-1.amazonaws.com/product-images/uuid-timestamp
```

Open that URL in a browser — if the image loads, the bucket policy and credentials are both correct.

---

## Step 7 — Open Amazon SES

All application email is sent through **Amazon SES** over HTTPS (port 443). This is required because the deploy host blocks all outbound SMTP ports — Gmail/GoDaddy SMTP time out with `Connection timeout`, but SES over HTTPS is never blocked.

1. In the AWS Console search bar, type **SES** and open **Amazon Simple Email Service**
2. In the top-right region selector, choose the region you want to send from — use **`us-east-1` (N. Virginia)** unless you have a reason to change it
3. Note the region you pick: it must match `SES_REGION` in your `.env` (Step 11)

> Verify your domain (Step 8) in the **same region** you send from. An identity verified in `us-east-1` does **not** work when sending from `ap-south-1`.

---

## Step 8 — Verify Your Sending Domain (GoDaddy)

Sending from your own domain (e.g. `support@astriagk.com`) gives professional, high-deliverability email.

1. In SES → **Configuration → Identities → Create identity**
2. Choose **Domain**, enter your GoDaddy domain (e.g. `astriagk.com`)
3. Leave **Easy DKIM** enabled (RSA 2048-bit) and click **Create identity**
4. SES now shows a set of **CNAME records** (3 for DKIM) — keep this page open
5. In a new tab, go to **GoDaddy → My Products → Domain → DNS → Manage DNS**
6. For each CNAME SES listed, click **Add Record** in GoDaddy:

   | Field | Value |
   |-------|-------|
   | **Type** | `CNAME` |
   | **Name/Host** | the SES-provided name (strip the trailing `.astriagk.com` — GoDaddy appends it automatically) |
   | **Value/Points to** | the SES-provided value |
   | **TTL** | 1 hour (default) |

7. Save. Verification completes automatically once DNS propagates (a few minutes to a few hours). The identity status flips to **Verified**.

> **Tip:** also add an SPF record if SES suggests one (a TXT record like `v=spf1 include:amazonses.com ~all`) for best inbox placement.

---

## Step 9 — Request Production Access (Leave the Sandbox)

New SES accounts start in the **sandbox**: max **200 emails/day**, 1 email/sec, and you can only send **to verified addresses**. To send to real users:

1. SES → **Account dashboard** → click **"Request production access"**
2. Choose **Transactional**, fill in your website URL and a short description of the email you send (OTPs, order updates, etc.)
3. Submit — approval is usually within 24 hours

> While waiting, you can still test: SES → **Identities → Create identity → Email address** to verify a personal address, then send to that address from sandbox.

---

## Step 10 — Grant the IAM User SES Permission

The app reuses the IAM user from Step 4 (same `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`). It needs permission to send:

1. IAM → **Users → `kronosquare-app` → Add permissions → Attach policies directly**
2. Attach **`AmazonSESFullAccess`** (or a custom policy allowing `ses:SendEmail` and `ses:SendRawEmail`)
3. Save

---

## Step 11 — Set Email Environment Variables

Add these to your `.env` (and your host's dashboard for production):

```env
EMAIL_FROM=support@astriagk.com
SES_REGION=us-east-1
```

- `EMAIL_FROM` — a sender address on your **verified** domain (Step 8). When this is set, the app sends via SES; when blank, it falls back to SMTP (local/dev only).
- `SES_REGION` — must match the region from Step 7. Defaults to `STORAGE_REGION` if unset.
- Credentials are **not** separate — SES reuses `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.

On server start you should see this log line confirming SES is active:

```
Email transport: Amazon SES (us-east-1) from support@astriagk.com
```

To test, trigger any email (e.g. sign up to receive an OTP). A successful send returns no error; failures are logged as `Failed to send email: ...`.

---

## Folder Structure in the Bucket

The app organises files by folder (passed as the `folder` argument to `uploadFile()`):

| Folder | Contents |
|--------|---------|
| `product-images/` | Product listing photos |
| `gst-documents/` | Seller GST certificate uploads |
| `site-content/` | Static assets like the email logo |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `InvalidAccessKeyId` | `STORAGE_ACCESS_KEY` is wrong or the IAM user was deleted |
| `SignatureDoesNotMatch` | `STORAGE_SECRET_KEY` is wrong |
| `NoSuchBucket` | `STORAGE_BUCKET_NAME` doesn't match the actual bucket name |
| `Access Denied` on upload | IAM user doesn't have `s3:PutObject` permission |
| Image URL returns `403 Forbidden` | Bucket policy (Step 3) is missing or incorrect |
| Image URL returns `NoSuchKey` | File upload failed silently — check server logs |
| Wrong region error | `STORAGE_REGION` doesn't match the bucket's region in AWS |

### Email (SES)

| Problem | Fix |
|---------|-----|
| `Email address is not verified` | `EMAIL_FROM` isn't on a verified domain, or you're still in sandbox sending to an unverified recipient (Steps 8–9) |
| `Connection timeout` on send | SES isn't being used — `EMAIL_FROM` is blank so it fell back to (blocked) SMTP. Set `EMAIL_FROM` (Step 11) |
| `AccessDenied` / `not authorized to perform ses:SendEmail` | IAM user is missing SES permission (Step 10) |
| `MessageRejected` | Domain not yet verified, or still in sandbox — check Identities status and request production access (Step 9) |
| Wrong region / identity not found | `SES_REGION` doesn't match the region where you verified the domain (Step 7) |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/file-storage.service.ts` | `uploadFile()` and `deleteFile()` — S3 SDK wrappers |
| `src/shared/services/email.service.ts` | `sendEmail()` / `sendTemplateEmail()` — SES SDK wrapper (SMTP fallback) |
| `src/modules/file-upload/file-upload.controller.ts` | Generic file upload endpoint |
| `src/modules/catalog/product_image/product_image.controller.ts` | Product image upload and delete |
| `src/modules/users/gst/gst.controller.ts` | GST document upload |
| `src/shared/config/env.ts` | Env var definitions (S3 + SES) |
