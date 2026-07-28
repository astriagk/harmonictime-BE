import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || "",
  DB_NAME: process.env.DB_NAME || "krono_square",
  JWT_SECRET: process.env.JWT_SECRET || "krono_square",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "krono_square_refresh",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

  // Google Sign-In (ID-token flow). The OAuth 2.0 *Web application* client ID
  // from Google Cloud Console → APIs & Services → Credentials. Used as the
  // required `audience` when verifying ID tokens, so a token minted for any
  // other app is rejected. It is a public value (the frontend ships it too);
  // the client *secret* is NOT needed for this flow — don't add one.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  // Optional CSV of additional accepted `aud` values, for future native
  // (Android/iOS) clients which mint tokens under their own client ids.
  GOOGLE_ADDITIONAL_CLIENT_IDS: process.env.GOOGLE_ADDITIONAL_CLIENT_IDS || "",

  // Base URL of the frontend app — used to build links in emails. Override per
  // environment via the FRONTEND_URL env var.
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:4200",

  // Public URL of the brand logo shown in email headers. Must be publicly
  // reachable (e.g. an S3 link) — email clients can't load local/embedded
  // images. When empty, emails fall back to the text wordmark.
  LOGO_URL:
    process.env.LOGO_URL ||
    "https://kronosquare.s3.us-east-1.amazonaws.com/site-content/email_logo/056ffe15-e090-459d-825f-00aa192b1ecb-1779439111383",

  // Brand identity shown in transactional emails — the header wordmark, the
  // invoice footer, and the "shopping with …" sign-offs. Override per
  // environment via the BRAND_* env vars; the defaults match production.
  BRAND_NAME: process.env.BRAND_NAME || "Krono²",
  BRAND_ADDRESS:
    process.env.BRAND_ADDRESS ||
    "No.12, 1st Floor, Kalappa Block, Srinagara, Pipeline, Bangalore - 560026",
  BRAND_EMAIL: process.env.BRAND_EMAIL || "krono2@astriagk.com",
  BRAND_PHONE: process.env.BRAND_PHONE || "(+91) 8861237563",

  // Amazon SES (HTTPS) transport — the only email channel. Sends over port 443
  // (never blocked, unlike SMTP). Reuses the AWS credentials below; the IAM user
  // must have the ses:SendEmail permission.
  //
  // EMAIL_FROM: the verified SES sender, e.g. "Harmonic Time
  // <noreply@yourdomain.com>". The domain (or address) must be verified in the
  // SES console.
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  // SES region — defaults to the S3 region. Verify your domain in this region.
  SES_REGION: process.env.SES_REGION || process.env.STORAGE_REGION || "us-east-1",
  // Where contact-form submissions are emailed. Falls back to the SES sender.
  CONTACT_RECIPIENT:
    process.env.CONTACT_RECIPIENT || process.env.EMAIL_FROM || "",

  // Amazon SNS — SMS / mobile OTP. Reuses the AWS credentials below; the IAM
  // user must have the sns:Publish permission.
  //
  // SMS_REGION is separate from SES_REGION on purpose: since 30 Apr 2025 AWS
  // only routes India local SMS through ap-south-1 / ap-south-2. Sending from
  // us-east-1 falls back to the international route.
  SMS_REGION: process.env.SMS_REGION || "ap-south-1",
  // Approved sender header, 3–6 letters, case-sensitive (e.g. "KRONO2").
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || "",
  // TRAI DLT Principal Entity ID and per-message template IDs. Required for
  // Indian numbers — carriers drop messages without a matching registration.
  // See docs/accounts/aws/sns-sms.md.
  SMS_DLT_ENTITY_ID: process.env.SMS_DLT_ENTITY_ID || "",
  SMS_DLT_TEMPLATE_ID_OTP: process.env.SMS_DLT_TEMPLATE_ID_OTP || "",
  SMS_DLT_TEMPLATE_ID_RESET: process.env.SMS_DLT_TEMPLATE_ID_RESET || "",

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  // Your Razorpay X current account number — required for penny-drop verification.
  // Activate Fund Account Validation in your Razorpay X dashboard before using.
  RAZORPAY_ACCOUNT_NUMBER: process.env.RAZORPAY_ACCOUNT_NUMBER || "",

  IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",

  STORAGE_REGION: process.env.STORAGE_REGION || "us-east-1",
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || "",
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY || "",
  STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME || "driver-documents",

  // Commission rates (decimals: 0.02 = 2%).
  // BUYER_COMMISSION_RATE  – added on top of the product price shown to buyers (DisplayPrice).
  //                          Goes to the platform; never deducted from the seller.
  // PLATFORM_COMMISSION_RATE – deducted from the seller's effective sale price.
  //                            Goes to the platform.
  // Hold days: how long after delivery a sale's amount is locked before it becomes withdrawable.
  BUYER_COMMISSION_RATE: Number(process.env.BUYER_COMMISSION_RATE ?? 0.02),
  PLATFORM_COMMISSION_RATE: Number(
    process.env.PLATFORM_COMMISSION_RATE ?? 0.02,
  ),
  PAYOUT_HOLD_DAYS: Number(process.env.PAYOUT_HOLD_DAYS ?? 7),

  // GST: rate applied when a product price is marked as tax-inclusive.
  // Threshold: seller must supply GST details once cumulative gross sales exceed this value.
  GST_RATE: Number(process.env.GST_RATE ?? 18),
  SELLER_GST_THRESHOLD: Number(process.env.SELLER_GST_THRESHOLD ?? 200000),

  // TrackingMore — used by tracking.service.ts to fetch live courier scan events.
  // Free plan at https://www.trackingmore.com — supports Delhivery, BlueDart, DTDC, Ekart, etc.
  TRACKINGMORE_API_KEY: process.env.TRACKINGMORE_API_KEY || "",
  // Shared secret for verifying inbound webhook calls from TrackingMore.
  // Set any random string here and mirror it in the TrackingMore webhook settings.
  TRACKING_WEBHOOK_SECRET: process.env.TRACKING_WEBHOOK_SECRET || "",
};
