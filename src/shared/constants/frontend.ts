import { env } from "../config/env";

// Frontend route paths (relative to FRONTEND_URL). Keep every path the backend
// links to here so a route change is a one-line edit. The host comes from
// env.FRONTEND_URL so it can differ per environment without code changes.
export const FRONTEND_ROUTES = {
  RESET_PASSWORD: "/auth/reset-password",
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
