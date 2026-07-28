import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import logger from "../utils/logger";

// Accepted `aud` values. GOOGLE_CLIENT_ID is the web client; the extra list is
// there for future native (Android/iOS) clients, which mint tokens under their
// own client ids. Passing this array to verifyIdToken means "aud must equal one
// of these" — never omit it, or any Google-issued token for any app on earth
// would be accepted here.
const audiences = [
  env.GOOGLE_CLIENT_ID,
  ...env.GOOGLE_ADDITIONAL_CLIENT_IDS.split(","),
]
  .map((a) => a.trim())
  .filter(Boolean);

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const VALID_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export interface GoogleIdentity {
  googleId: string; // `sub` — stable per (user, project), never reused
  email: string; // lowercased
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

// Verifies a Google ID token (a JWT) locally against Google's cached public
// keys — signature, `exp`, `iss` and, critically, `aud`. Only ID tokens are
// accepted: a Google *access* token ("ya29...") is not audience-bound and would
// let any app that holds one sign in as that user, so it must never be taken
// here. verifyIdToken rejects non-JWTs, which is the enforcement.
export const verifyGoogleIdToken = async (
  idToken: string,
): Promise<GoogleIdentity> => {
  if (audiences.length === 0) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Google Sign-In is not configured",
    );
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch (err: any) {
    // Log the real reason (expired vs wrong audience vs bad signature) but
    // return one opaque error: telling a caller their token was structurally
    // fine only helps an attacker.
    logger.warn(`Google ID token rejected: ${err?.message}`);
    throw ApiError.unauthorized("Invalid or expired Google token");
  }

  // The library already enforces the issuer; assert it explicitly so a future
  // config mistake can't silently widen who we trust.
  if (!payload?.iss || !VALID_ISSUERS.includes(payload.iss)) {
    throw ApiError.unauthorized("Invalid or expired Google token");
  }
  if (!payload.sub || !payload.email) {
    throw ApiError.unauthorized("Invalid Google token payload");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    // Strict equality on purpose — this claim gates account linking, and a
    // truthy check on an attacker-influenced value is a takeover primitive.
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
};
