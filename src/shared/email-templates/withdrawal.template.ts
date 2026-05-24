import { EmailTemplate } from "./types";
import { layout } from "./layout";

export const withdrawalPaidEmail = (amount: number, reference?: string): EmailTemplate => ({
  subject: "Your withdrawal has been processed",
  text: `Your withdrawal request of ₹${amount.toFixed(2)} has been processed and the amount has been transferred to your bank account.${reference ? ` Transaction reference: ${reference}.` : ""}`,
  html: layout(`
    <h2 style="margin:0 0 16px;color:#16a34a;">Withdrawal Processed ✓</h2>
    <p style="margin:0 0 12px;">Your withdrawal request has been processed successfully.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tr>
        <td style="padding:10px 12px;background:#f4f4f5;border-radius:6px 6px 0 0;font-weight:bold;width:40%;">Amount</td>
        <td style="padding:10px 12px;background:#f4f4f5;border-radius:6px 6px 0 0;">₹${amount.toFixed(2)}</td>
      </tr>
      ${reference ? `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid #e4e4e7;font-weight:bold;">Reference / UTR</td>
        <td style="padding:10px 12px;border-top:1px solid #e4e4e7;">${reference}</td>
      </tr>` : ""}
    </table>
    <p style="margin:0;">The amount will be credited to your registered bank account within 1–2 business days depending on your bank.</p>
  `),
});

export const withdrawalRejectedEmail = (amount: number, notes?: string): EmailTemplate => ({
  subject: "Your withdrawal request has been rejected",
  text: `Your withdrawal request of ₹${amount.toFixed(2)} has been rejected.${notes ? ` Reason: ${notes}.` : ""} Your earnings have been released back to your wallet and you can request a new withdrawal.`,
  html: layout(`
    <h2 style="margin:0 0 16px;color:#dc2626;">Withdrawal Rejected</h2>
    <p style="margin:0 0 12px;">Your withdrawal request has been rejected by our team.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tr>
        <td style="padding:10px 12px;background:#f4f4f5;border-radius:6px 6px 0 0;font-weight:bold;width:40%;">Amount</td>
        <td style="padding:10px 12px;background:#f4f4f5;border-radius:6px 6px 0 0;">₹${amount.toFixed(2)}</td>
      </tr>
      ${notes ? `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid #e4e4e7;font-weight:bold;">Reason</td>
        <td style="padding:10px 12px;border-top:1px solid #e4e4e7;">${notes}</td>
      </tr>` : ""}
    </table>
    <p style="margin:0;">Your earnings have been released back to your wallet. You can submit a new withdrawal request once any issues are resolved.</p>
  `),
});
