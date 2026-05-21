import nodemailer from "nodemailer";
import { env } from "../config/env";
import logger from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  message: string
): Promise<boolean> => {
  try {
    await transporter.sendMail({ from: env.EMAIL_USER, to, subject, text: message });
    return true;
  } catch (err) {
    logger.error(`Failed to send email: ${err}`);
    return false;
  }
};
