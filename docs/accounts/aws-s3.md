# AWS S3 — Account Setup Guide

Used for: storing product images, GST documents, and site content (like the email logo).  
**Free tier:** 5 GB storage, 20,000 GET requests, 2,000 PUT requests per month for 12 months.

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
5. Search for and attach **`AmazonS3FullAccess`**

   > For tighter security in production, create a custom policy that only allows `s3:PutObject` and `s3:DeleteObject` on your specific bucket.

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

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/file-storage.service.ts` | `uploadFile()` and `deleteFile()` — S3 SDK wrappers |
| `src/modules/file-upload/file-upload.controller.ts` | Generic file upload endpoint |
| `src/modules/catalog/product_image/product_image.controller.ts` | Product image upload and delete |
| `src/modules/users/gst/gst.controller.ts` | GST document upload |
| `src/shared/config/env.ts` | Env var definitions |
