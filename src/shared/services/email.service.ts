import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "../config/env";
import logger from "../utils/logger";

// Primary transport is Amazon SES over HTTPS (port 443). SMTP is blocked on the
// deploy host (all SMTP ports time out), so SES is the only channel that works
// in production. SMTP is kept only as a local/dev fallback for when EMAIL_FROM
// is not configured.
const useSes = !!env.EMAIL_FROM;

const ses = useSes
  ? new SESv2Client({
      region: env.SES_REGION,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
    })
  : null;

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
  // unreachable. Without these, sendMail can stall for minutes and surface as a
  // gateway timeout on whichever endpoint awaited it.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

// Log the active transport once at startup so failures are easy to diagnose.
if (useSes) {
  logger.info(
    `Email transport: Amazon SES (${env.SES_REGION}) from ${env.EMAIL_FROM}`,
  );
} else {
  transporter.verify().then(
    () =>
      logger.info(
        `Email transport: SMTP ${env.EMAIL_HOST}:${env.EMAIL_PORT} (secure=${env.EMAIL_SECURE}) as ${env.EMAIL_USER}`,
      ),
    (err) =>
      logger.error(
        `SMTP connection failed for ${env.EMAIL_HOST}:${env.EMAIL_PORT} — ${err}. ` +
          `If this is a connection timeout, your host is blocking outbound SMTP; ` +
          `set EMAIL_FROM (a verified SES sender) to send via Amazon SES over HTTPS.`,
      ),
  );
}

export const sendEmail = async (
  to: string,
  subject: string,
  message: string,
  html?: string
): Promise<boolean> => {
  try {
    if (useSes) {
      await ses!.send(
        new SendEmailCommand({
          FromEmailAddress: env.EMAIL_FROM,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: {
                Text: { Data: message, Charset: "UTF-8" },
                ...(html
                  ? { Html: { Data: html, Charset: "UTF-8" } }
                  : {}),
              },
            },
          },
        }),
      );
    } else {
      await transporter.sendMail({
        from: env.EMAIL_FROM || env.EMAIL_USER,
        to,
        subject,
        text: message,
        ...(html ? { html } : {}),
      });
    }
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
