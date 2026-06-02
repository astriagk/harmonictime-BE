import { EmailTemplate } from "./types";

const BRAND_NAME = "Krono²";
const BRAND_ADDRESS = "22, 1st cross, BHK Layout, Bangalore - 560026";
const BRAND_EMAIL = "krono2@astriagk.com";
const BRAND_PHONE = "(+91) 88673 47448";

export interface OrderConfirmationItem {
  productName: string;
  quantity: number;
  mrp: number;
  offerPercentage: number;
  offerAmount: number;
  amount: number;
  isTaxInclusive: boolean;
}

export interface OrderConfirmationData {
  invoiceNumber: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddressLine1: string;
  buyerAddressLine2?: string;
  buyerCity: string;
  buyerState: string;
  buyerPostalCode: string;
  buyerCountry: string;
  issuedOn: Date;
  items: OrderConfirmationItem[];
  subtotal: number;
  gst: number;
  total: number;
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
      <td style="padding:14px 12px;font-size:14px;color:#18181b;border-bottom:1px solid #f4f4f5;">
        ${item.productName}
      </td>
      <td style="padding:14px 12px;font-size:14px;color:#18181b;text-align:center;border-bottom:1px solid #f4f4f5;">
        ${item.quantity}
      </td>
      <td style="padding:14px 12px;font-size:14px;color:#18181b;text-align:right;border-bottom:1px solid #f4f4f5;">
        ${fmt(item.mrp)}
      </td>
      <td style="padding:14px 12px;font-size:14px;color:#18181b;text-align:right;border-bottom:1px solid #f4f4f5;">
        ${
          item.offerAmount > 0
            ? `<span style="display:block;">- ${fmt(item.offerAmount)}</span>
               <span style="font-size:11px;color:#71717a;">${item.offerPercentage}% off</span>`
            : `<span style="color:#a1a1aa;">&mdash;</span>`
        }
      </td>
      <td style="padding:14px 12px;font-size:14px;font-weight:bold;color:#18181b;text-align:right;border-bottom:1px solid #f4f4f5;">
        ${fmt(item.amount)}
        ${item.isTaxInclusive ? `<span style="display:block;font-size:10px;font-weight:normal;color:#71717a;">incl. GST</span>` : ""}
      </td>
    </tr>`,
    )
    .join("");
}

export const orderConfirmationEmail = (
  data: OrderConfirmationData,
): EmailTemplate => {
  const issuedOnStr = data.issuedOn.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const invoiceNum = data.invoiceNumber.toUpperCase();

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

          <!-- ── Invoice Header ── -->
          <tr>
            <td style="padding:32px 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:28px;font-weight:bold;color:#18181b;">Invoice</td>
                  <td style="text-align:right;font-size:16px;font-style:italic;font-weight:bold;color:#18181b;">
                    ${BRAND_NAME}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Separator -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" />
            </td>
          </tr>

          <!-- ── Billed By / Billed To ── -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:50%;vertical-align:top;">
                    <p style="margin:0 0 6px;font-size:10px;color:#71717a;letter-spacing:0.05em;">BILLED BY</p>
                    <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#18181b;">${BRAND_NAME}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${BRAND_ADDRESS}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${BRAND_EMAIL}</p>
                    <p style="margin:0;font-size:12px;color:#3f3f46;">${BRAND_PHONE}</p>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-left:20px;">
                    <p style="margin:0 0 6px;font-size:10px;color:#71717a;letter-spacing:0.05em;">BILLED TO</p>
                    <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#18181b;">${data.buyerName}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${data.buyerAddressLine1}${data.buyerAddressLine2 ? ", " + data.buyerAddressLine2 : ""}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${data.buyerCity}, ${data.buyerState} - ${data.buyerPostalCode}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${data.buyerCountry}</p>
                    <p style="margin:0 0 2px;font-size:12px;color:#3f3f46;">${data.buyerPhone}</p>
                    <p style="margin:0;font-size:12px;color:#3f3f46;">${data.buyerEmail}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Meta: Issued On, Status, Invoice # ── -->
          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:10px;color:#71717a;letter-spacing:0.05em;padding-bottom:6px;width:160px;">ISSUED ON</td>
                  <td style="font-size:13px;color:#18181b;padding-bottom:6px;">${issuedOnStr}</td>
                </tr>
                <tr>
                  <td style="font-size:10px;color:#71717a;letter-spacing:0.05em;padding-bottom:6px;">PAYMENT STATUS</td>
                  <td style="font-size:13px;color:#18181b;padding-bottom:6px;">Paid</td>
                </tr>
                <tr>
                  <td style="font-size:10px;color:#71717a;letter-spacing:0.05em;">INVOICE #</td>
                  <td style="font-size:13px;font-weight:bold;color:#18181b;">${invoiceNum}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Product Table ── -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse:collapse;">
                <!-- Table Header -->
                <thead>
                  <tr style="background:#18181b;">
                    <th style="padding:12px 12px;font-size:11px;font-weight:bold;color:#ffffff;text-align:left;letter-spacing:0.04em;">
                      ITEM DESCRIPTION
                    </th>
                    <th style="padding:12px 12px;font-size:11px;font-weight:bold;color:#ffffff;text-align:center;letter-spacing:0.04em;">
                      QTY
                    </th>
                    <th style="padding:12px 12px;font-size:11px;font-weight:bold;color:#ffffff;text-align:right;letter-spacing:0.04em;">
                      UNIT MRP
                    </th>
                    <th style="padding:12px 12px;font-size:11px;font-weight:bold;color:#ffffff;text-align:right;letter-spacing:0.04em;">
                      OFFER
                    </th>
                    <th style="padding:12px 12px;font-size:11px;font-weight:bold;color:#ffffff;text-align:right;letter-spacing:0.04em;">
                      AMOUNT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows(data.items)}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- ── Summary ── -->
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td></td>
                  <td style="width:260px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#18181b;">Subtotal</td>
                        <td style="padding:5px 0;font-size:13px;color:#18181b;text-align:right;">${fmt(data.subtotal)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#18181b;">GST (18%)</td>
                        <td style="padding:5px 0;font-size:13px;color:#18181b;text-align:right;">
                          ${data.gst > 0 ? fmt(data.gst) : `<span style="font-style:italic;color:#71717a;">Included in price</span>`}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <hr style="border:none;border-top:1px solid #18181b;margin:0;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:#18181b;">Total Amount Paid</td>
                        <td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:#18181b;text-align:right;">${fmt(data.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:28px 32px 20px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;" />
              <p style="margin:0;font-size:12px;font-style:italic;color:#71717a;text-align:center;">
                Thank you for shopping with ${BRAND_NAME}. We appreciate your purchase.
                If you have any questions regarding this invoice, feel free to contact us at ${BRAND_EMAIL}.
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
    .map(
      (i) =>
        `${i.productName} × ${i.quantity}: ${fmt(i.amount)}${i.offerAmount > 0 ? ` (${i.offerPercentage}% off)` : ""}`,
    )
    .join("\n");

  return {
    subject: `Your Order Confirmation – Invoice #${invoiceNum}`,
    text: [
      `Invoice #${invoiceNum}`,
      `Issued On: ${issuedOnStr}`,
      `Payment Status: Paid`,
      ``,
      `Items:`,
      itemLines,
      ``,
      `Subtotal: ${fmt(data.subtotal)}`,
      `GST (18%): ${data.gst > 0 ? fmt(data.gst) : "Included in price"}`,
      `Total Amount Paid: ${fmt(data.total)}`,
      ``,
      `Thank you for shopping with ${BRAND_NAME}. Contact us at ${BRAND_EMAIL} for any questions.`,
    ].join("\n"),
    html,
  };
};
