import { EmailTemplate } from "./types";
import { env } from "../config/env";

const BRAND_NAME = env.BRAND_NAME;
const BRAND_EMAIL = env.BRAND_EMAIL;

export interface OrderConfirmationItem {
  productName: string;
  quantity: number;
  amount: number;
}

// A confirmation email is intentionally NOT an invoice. It only acknowledges
// the order; the full tax invoice lives in the buyer's account, where they can
// view and download it (see `invoiceUrl`).
export interface OrderConfirmationData {
  orderNumber: string;
  buyerName: string;
  orderDate: Date;
  items: OrderConfirmationItem[];
  total: number;
  invoiceUrl: string;
}

function fmt(amount: number): string {
  return `&#8377;${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function itemRows(items: OrderConfirmationItem[]): string {
  return items
    .map(
      (item) => `
    <tr>
      <td style="padding:12px 0;font-size:14px;color:#18181b;border-bottom:1px solid #f4f4f5;">
        ${item.productName}
        <span style="color:#71717a;">&times; ${item.quantity}</span>
      </td>
      <td style="padding:12px 0;font-size:14px;font-weight:bold;color:#18181b;text-align:right;border-bottom:1px solid #f4f4f5;">
        ${fmt(item.amount)}
      </td>
    </tr>`,
    )
    .join("");
}

export const orderConfirmationEmail = (
  data: OrderConfirmationData,
): EmailTemplate => {
  const orderDateStr = data.orderDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const orderNum = data.orderNumber.toUpperCase();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#18181b;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:bold;">
              ${BRAND_NAME}
            </td>
          </tr>

          <!-- ── Confirmation message ── -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#18181b;">Order confirmed</p>
              <p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.5;">
                Hi ${data.buyerName}, thanks for your order! We've received your payment and
                your order is being processed.
              </p>
            </td>
          </tr>

          <!-- ── Order meta ── -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;color:#71717a;letter-spacing:0.05em;padding-bottom:6px;width:140px;">ORDER NUMBER</td>
                  <td style="font-size:13px;font-weight:bold;color:#18181b;padding-bottom:6px;">${orderNum}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#71717a;letter-spacing:0.05em;">ORDER DATE</td>
                  <td style="font-size:13px;color:#18181b;">${orderDateStr}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Items ── -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tbody>
                  ${itemRows(data.items)}
                  <tr>
                    <td style="padding:14px 0 0;font-size:15px;font-weight:bold;color:#18181b;">Total paid</td>
                    <td style="padding:14px 0 0;font-size:15px;font-weight:bold;color:#18181b;text-align:right;">${fmt(data.total)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- ── Invoice CTA ── -->
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <a href="${data.invoiceUrl}"
                 style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-size:14px;">
                View &amp; download invoice
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:#71717a;">
                Your full tax invoice is available in your account.
              </p>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:28px 32px 24px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;font-style:italic;color:#71717a;text-align:center;">
                Thank you for shopping with ${BRAND_NAME}. If you have any questions about your
                order, contact us at ${BRAND_EMAIL}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const itemLines = data.items
    .map((i) => `${i.productName} × ${i.quantity}: ${fmt(i.amount)}`)
    .join("\n");

  return {
    subject: `Order confirmed – ${orderNum}`,
    text: [
      `Order confirmed`,
      ``,
      `Hi ${data.buyerName}, thanks for your order! We've received your payment and your order is being processed.`,
      ``,
      `Order Number: ${orderNum}`,
      `Order Date: ${orderDateStr}`,
      ``,
      `Items:`,
      itemLines,
      ``,
      `Total paid: ${fmt(data.total)}`,
      ``,
      `View and download your invoice from your account: ${data.invoiceUrl}`,
      ``,
      `Thank you for shopping with ${BRAND_NAME}. Contact us at ${BRAND_EMAIL} for any questions.`,
    ].join("\n"),
    html,
  };
};
