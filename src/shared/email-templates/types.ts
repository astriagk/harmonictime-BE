// Every email template returns this shape. `text` is the plain-text fallback,
// `html` is the rich version. Pass the whole object to sendTemplateEmail().
export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}
