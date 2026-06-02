import { EmailTemplate } from "./types";
import { layout } from "./layout";
import { verifyEmailUrl } from "../constants/frontend";

export const verifyEmailTemplate = (
  token: string,
  email: string,
): EmailTemplate => {
  const link = verifyEmailUrl(token, email);

  return {
    subject: "Verify your Krono² email address",
    text: `Please verify your email address by clicking the link below.\n\nThis link expires in 24 hours.\n\n${link}\n\nIf you didn't create an account, you can safely ignore this email.`,
    html: layout(`
      <h2 style="margin:0 0 16px;">Verify your email address</h2>
      <p style="margin:0 0 16px;">Thanks for signing up! Click the button below to verify your email address and activate your account.</p>
      <p style="margin:0 0 20px;text-align:center;">
        <a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:bold;">Verify email</a>
      </p>
      <p style="margin:0 0 12px;color:#71717a;font-size:13px;">This link expires in 24 hours. If the button doesn't work, copy and paste the URL below into your browser:</p>
      <p style="margin:0;font-size:12px;word-break:break-all;color:#71717a;">${link}</p>
    `),
  };
};
