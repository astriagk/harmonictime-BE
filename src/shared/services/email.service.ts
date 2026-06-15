import nodemailer from "nodemailer";
import { env } from "../config/env";
import logger from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: env.EMAIL_USER,
    // Strip spaces so a pasted Gmail app password ("xxxx xxxx xxxx xxxx") authenticates.
    pass: env.EMAIL_PASS.replace(/\s/g, ""),
  },
});

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
