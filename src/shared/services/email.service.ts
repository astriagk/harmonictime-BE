import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "../config/env";
import logger from "../utils/logger";

// Email is sent exclusively via Amazon SES over HTTPS (port 443) — SMTP is
// blocked on the deploy host, so SES is the only channel that works in
// production. Reuses the AWS STORAGE_* credentials; the IAM user must have the
// ses:SendEmail permission, and EMAIL_FROM must be a SES-verified sender.
const ses = new SESv2Client({
  region: env.SES_REGION,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

// Log the active transport once at startup so failures are easy to diagnose.
if (env.EMAIL_FROM) {
  logger.info(
    `Email transport: Amazon SES (${env.SES_REGION}) from ${env.EMAIL_FROM}`,
  );
} else {
  logger.warn(
    "EMAIL_FROM is not set — emails will fail. Set it to a SES-verified sender.",
  );
}

export const sendEmail = async (
  to: string,
  subject: string,
  message: string,
  html?: string
): Promise<boolean> => {
  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: env.EMAIL_FROM,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: message, Charset: "UTF-8" },
              ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
            },
          },
        },
      }),
    );
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
