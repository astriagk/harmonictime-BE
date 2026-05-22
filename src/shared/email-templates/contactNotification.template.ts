import { EmailTemplate } from "./types";
import { layout } from "./layout";

export interface ContactNotificationInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

// Sent to the site owner when a visitor submits the Contact Us form.
export const contactNotificationEmail = (
  input: ContactNotificationInput
): EmailTemplate => {
  const { name, email, phone, subject, message } = input;

  const textLines = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    subject ? `Subject: ${subject}` : null,
    "",
    message,
  ].filter((line) => line !== null);

  const row = (label: string, value: string) =>
    `<p style="margin:0 0 8px;"><strong>${label}:</strong> ${value}</p>`;

  return {
    subject: subject ? `Contact form: ${subject}` : `New contact form submission from ${name}`,
    text: textLines.join("\n"),
    html: layout(`
      <h2 style="margin:0 0 16px;">New contact form submission</h2>
      ${row("Name", name)}
      ${row("Email", email)}
      ${phone ? row("Phone", phone) : ""}
      ${subject ? row("Subject", subject) : ""}
      <p style="margin:16px 0 4px;"><strong>Message:</strong></p>
      <p style="margin:0;white-space:pre-wrap;">${message}</p>
    `),
  };
};
