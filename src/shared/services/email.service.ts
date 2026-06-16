import nodemailer from "nodemailer";
import { env } from "../config/env";
import logger from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_SECURE,
  // On 587 require the STARTTLS upgrade — never fall back to plaintext.
  requireTLS: !env.EMAIL_SECURE,
  auth: {
    user: env.EMAIL_USER,
    // Strip spaces so a pasted app password ("xxxx xxxx xxxx xxxx") authenticates.
    pass: env.EMAIL_PASS.replace(/\s/g, ""),
  },
  // Fail fast instead of hanging the request when the SMTP host is slow or
  // unreachable (Gmail's port 465 is often blocked/throttled on cloud hosts —
  // see env.ts). Without these, sendMail can stall for minutes and surface as a
  // gateway timeout on whichever endpoint awaited it.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

// Verify the SMTP connection once at startup. A "Connection timeout" here means
// the host is blocking outbound SMTP (common on Railway/Render) — the app can't
// reach Gmail over SMTP at all, regardless of port. This logs the real cause
// instead of letting every send fail silently later.
transporter.verify().then(
  () =>
    logger.info(
      `SMTP ready: ${env.EMAIL_HOST}:${env.EMAIL_PORT} (secure=${env.EMAIL_SECURE}) as ${env.EMAIL_USER}`,
    ),
  (err) =>
    logger.error(
      `SMTP connection failed for ${env.EMAIL_HOST}:${env.EMAIL_PORT} — ${err}. ` +
        `If this is a connection timeout, your host is blocking outbound SMTP; ` +
        `use the Gmail API over HTTPS instead.`,
    ),
);

export const sendEmail = async (
  to: string,
  subject: string,
  message: string,
  html?: string
): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: env.EMAIL_USER,
      to,
      subject,
      text: message,
      ...(html ? { html } : {}),
    });
    return true;
  } catch (err) {
    logger.error(`Failed to send email: ${err}`);
    return false;
  }
};

// Send a prepared template (subject + text + html) to a recipient.
// Prefer this over sendEmail for any reusable email — see src/shared/email-templates.
export const sendTemplateEmail = (
  to: string,
  template: { subject: string; text: string; html: string }
): Promise<boolean> =>
  sendEmail(to, template.subject, template.text, template.html);
