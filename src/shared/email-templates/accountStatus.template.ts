import { EmailTemplate } from "./types";
import { layout } from "./layout";

export const accountBlockedEmail = (): EmailTemplate => ({
  subject: "Your Krono² account has been blocked",
  text: "Your account has been blocked by our team. You will not be able to log in until it is reviewed. If you believe this is a mistake, please contact support.",
  html: layout(`
    <h2 style="margin:0 0 16px;color:#dc2626;">Account Blocked</h2>
    <p style="margin:0 0 12px;">Your Krono² account has been <strong>blocked</strong> by our team.</p>
    <p style="margin:0 0 12px;">You will not be able to log in or access your account while it is blocked.</p>
    <p style="margin:0;">If you believe this is a mistake or would like to appeal, please contact our support team.</p>
  `),
});

export const accountSuspendedEmail = (): EmailTemplate => ({
  subject: "Your Krono² account has been suspended",
  text: "Your account has been temporarily suspended. You will not be able to log in during this period. Please contact support if you have any questions.",
  html: layout(`
    <h2 style="margin:0 0 16px;color:#d97706;">Account Suspended</h2>
    <p style="margin:0 0 12px;">Your Krono² account has been <strong>temporarily suspended</strong>.</p>
    <p style="margin:0 0 12px;">You will not be able to log in or access your account during the suspension period.</p>
    <p style="margin:0;">If you have any questions or would like more information, please contact our support team.</p>
  `),
});

export const accountRestoredEmail = (): EmailTemplate => ({
  subject: "Your Krono² account has been restored",
  text: "Good news — your Krono² account has been restored and you can log in again. Welcome back!",
  html: layout(`
    <h2 style="margin:0 0 16px;color:#16a34a;">Account Restored</h2>
    <p style="margin:0 0 12px;">Good news! Your Krono² account has been <strong>restored</strong> and is now active.</p>
    <p style="margin:0;">You can log in again and continue using all features. Welcome back!</p>
  `),
});
