# AWS S3 — Bucket & IAM User Setup

Sets up file storage (product images, GST documents, site content) and the **IAM user that SES also reuses** for email. Do this once per environment (dev and prod each get their own bucket + IAM user).

**S3 free tier:** 5 GB storage, 20,000 GET requests, 2,000 PUT requests per month for 12 months.

> After finishing here, set up email with [ses-dev.md](ses-dev.md) (dev) or [ses-prod.md](ses-prod.md) (prod). SES reuses the IAM user created in Step 4.

---

## Step 1 — Create an AWS Account

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and click **"Create an AWS Account"**
2. Enter your email and choose an account name (e.g. `krono-square`)
3. Provide a credit/debit card — AWS won't charge unless you exceed the free tier
4. Complete identity verification (phone OTP)
5. Choose the **Free** support plan
6. Sign in to the AWS Console

> If the account already exists, skip to Step 2.

---

## Step 2 — Create an S3 Bucket

1. In the AWS Console search bar, type **S3** and open it
2. Click **"Create bucket"**
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Bucket name** | dev: `harmonic-time` · prod: `kronosquare` (must be globally unique) |
   | **AWS Region** | `us-east-1` (must match `STORAGE_REGION`) |
   | **Object Ownership** | ACLs disabled (recommended) |
   | **Block Public Access** | **Uncheck** "Block all public access" — files must be publicly readable |
   | **Versioning** | Disable (not needed) |

4. Click **"Create bucket"**

---

## Step 3 — Make the Bucket Publicly Readable

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

> This lets anyone **read** files (view images) but only the IAM user (Step 4) can **upload or delete** them.

---

## Step 4 — Create an IAM User for the App

Don't use root AWS credentials in `.env`. Create a limited IAM user instead.

1. AWS Console → **IAM → Users → Create user**
2. Username: `kronosquare-app` (prod) or a dev-specific name
3. Click **"Next"** (skip "Add to group")
4. **"Set permissions"** → choose **"Attach policies directly"**
5. Attach **`AmazonS3FullAccess`** — and, since this same user also sends email, attach **`AmazonSESFullAccess`** too (used by the SES guides)

   > Tighter alternative for production: a custom policy allowing only `s3:PutObject` + `s3:DeleteObject` on your bucket and `ses:SendEmail` + `ses:SendRawEmail`.

6. Click **"Create user"**
7. Open the user → **Security credentials** tab
8. Under **Access keys** → **"Create access key"**
9. Choose **"Application running outside AWS"**
10. Click **"Create access key"**
11. **Copy both the Access Key ID and Secret Access Key** — the secret is shown only once

---

## Step 5 — Set Environment Variables

Add to `.env` (dev) or `.env.prod` (prod):

```env
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your_access_key_id
STORAGE_SECRET_KEY=your_secret_access_key
STORAGE_BUCKET_NAME=harmonic-time   # dev — use kronosquare for prod
```

- `STORAGE_REGION` — must match the region from Step 2
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` — from Step 4
- `STORAGE_BUCKET_NAME` — the exact bucket name from Step 2

---

## Step 6 — Test the Upload

Start the server and upload a product image:

```
POST http://localhost:5000/api/products/:productId/images
Authorization: Bearer <seller_token>
Content-Type: multipart/form-data

file: [attach any image file]
```

The response URL looks like:

```
https://harmonic-time.s3.us-east-1.amazonaws.com/product-images/uuid-timestamp
```

Open it in a browser — if the image loads, the bucket policy and credentials are correct.

---

## Folder Structure in the Bucket

Files are organised by folder (the `folder` argument to `uploadFile()`):

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
| Wrong region error | `STORAGE_REGION` doesn't match the bucket's region |

---

Next: [ses-dev.md](ses-dev.md) · [ses-prod.md](ses-prod.md) · back to [README](README.md)
