import { EmailTemplate } from "./types";
import { layout } from "./layout";
import { resetPasswordUrl } from "../constants/frontend";
import { env } from "../config/env";

// OTP sent when a user requests a password reset (POST /api/verify-email).
// The code is valid for 10 minutes. The link carries a signed reset token so
// the reset page can identify the user without asking for email/phone (host
// comes from env.FRONTEND_URL — see src/shared/constants/frontend.ts).
export const passwordResetOtpEmail = (
  otp: string,
  token: string,
): EmailTemplate => {
  const link = resetPasswordUrl(token);

  return {
    subject: `Reset your ${env.BRAND_NAME} password`,
    text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes.\nReset your password here: ${link}\n\nIf you didn't request it, you can ignore this email.`,
    html: layout(`
      <h2 style="margin:0 0 16px;">Password reset code</h2>
      <p style="margin:0 0 16px;">Use the code below to reset your password. It expires in 10 minutes.</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;padding:14px 0;text-align:center;border-radius:6px;">${otp}</p>
      <p style="margin:0 0 20px;text-align:center;">
        <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">Reset password</a>
      </p>
      <p style="margin:0;color:#71717a;">If you didn't request a reset, you can safely ignore this email.</p>
    `),
  };
};
