import { env } from "../config/env";

// Frontend route paths (relative to FRONTEND_URL). Keep every path the backend
// links to here so a route change is a one-line edit. The host comes from
// env.FRONTEND_URL so it can differ per environment without code changes.
export const FRONTEND_ROUTES = {
  RESET_PASSWORD: "/auth/reset-password",
  VERIFY_EMAIL: "/auth/verify-email",
  POST_VERIFICATION_INDIVIDUAL: "/buyer/products",
  POST_VERIFICATION_BUSINESS: "/auth/gst-onboarding",
  ORDERS: "/buyer/orders",
} as const;

// Join FRONTEND_URL with a route path (handles a trailing slash on the base).
export const buildFrontendUrl = (path: string): string =>
  `${env.FRONTEND_URL.replace(/\/+$/, "")}${path}`;

// Full password-reset link carrying the signed reset token. The reset page
// reads `token` from the query and sends it back (with the OTP + new password)
// so the backend can identify the user without asking for email/phone.
export const resetPasswordUrl = (token?: string): string => {
  const url = buildFrontendUrl(FRONTEND_ROUTES.RESET_PASSWORD);
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

// Full email-verification link. The page calls POST /api/auth/confirm-email
// with this token to mark the account as verified. Email is included so the
// frontend can pre-fill the resend form without asking the user to type it.
export const verifyEmailUrl = (token: string, email: string): string =>
  `${buildFrontendUrl(FRONTEND_ROUTES.VERIFY_EMAIL)}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

// Buyer's orders page, where they can view the full invoice and download it.
// Order confirmation emails link here instead of attaching the invoice.
export const ordersUrl = (): string => buildFrontendUrl(FRONTEND_ROUTES.ORDERS);
