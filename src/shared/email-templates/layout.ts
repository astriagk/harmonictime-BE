// Shared HTML shell so every email looks consistent. Templates supply the inner
// body markup; this wraps it with the brand header and a footer.
import { env } from "../config/env";

const BRAND = "Harmonic Time";

// Logo image when LOGO_URL is configured, otherwise the text wordmark. Both sit
// on the same dark header background for a consistent look.
const header = (): string =>
  env.LOGO_URL
    ? `<td style="background:#18181b;padding:20px 32px;">
         <img src="${env.LOGO_URL}" alt="${BRAND}" height="36" style="height:36px;display:block;border:0;" />
       </td>`
    : `<td style="background:#18181b;padding:20px 32px;color:#ffffff;font-size:20px;font-weight:bold;">
         ${BRAND}
       </td>`;

export const layout = (bodyHtml: string): string => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              ${header()}
            </tr>
            <tr>
              <td style="padding:32px;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#fafafa;color:#71717a;font-size:12px;">
                You're receiving this email from ${BRAND}. If you weren't expecting it, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
