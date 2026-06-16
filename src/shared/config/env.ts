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

  // Base URL of the frontend app — used to build links in emails. Override per
  // environment via the FRONTEND_URL env var.
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:4200",

  // Public URL of the brand logo shown in email headers. Must be publicly
  // reachable (e.g. an S3 link) — email clients can't load local/embedded
  // images. When empty, emails fall back to the text wordmark.
  LOGO_URL:
    process.env.LOGO_URL ||
    "https://kronosquare.s3.us-east-1.amazonaws.com/site-content/email_logo/056ffe15-e090-459d-825f-00aa192b1ecb-1779439111383",

  // SMTP transport (Gmail). Default to port 587 (STARTTLS): port 465 (implicit
  // TLS) is the most aggressively blocked SMTP port on cloud hosts (e.g.
  // Railway), so 465 is a poor default when EMAIL_PORT is unset in the host's
  // dashboard. If 587 is ALSO blocked on your host, SMTP can't reach Gmail at
  // all — switch to the Gmail API (HTTPS) instead of any SMTP port.
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: Number(process.env.EMAIL_PORT ?? 587),
  // secure=true for port 465 (implicit TLS), false for 587 (STARTTLS).
  EMAIL_SECURE: process.env.EMAIL_SECURE
    ? process.env.EMAIL_SECURE === "true"
    : Number(process.env.EMAIL_PORT ?? 587) === 465,
  EMAIL_USER: process.env.EMAIL_USER || "",
  EMAIL_PASS: process.env.EMAIL_PASS || "",
  // Where contact-form submissions are emailed. Falls back to the sender account.
  CONTACT_RECIPIENT:
    process.env.CONTACT_RECIPIENT || process.env.EMAIL_USER || "",

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID || "",

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
