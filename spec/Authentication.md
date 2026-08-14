# Authentication System — Technical Spec

**Version:** 1.0.0 | **Status:** Active | **Audience:** Developers & Reviewers

> This document covers how authentication works end-to-end in the Krono Square backend —
> including registration, login, token lifecycle, email delivery, input validation, and data storage.

---

## 1. Overview

Authentication is **JWT-based and stateless** for access tokens, with **stateful refresh tokens** stored as bcrypt hashes in the database. The system enforces:

- Email verification before any login is allowed
- OTP-based password reset (email or SMS)
- Role-based access control (Customer, Seller, Admin)
- Account status gating (active / blocked / suspended)

**Core files:**

| Concern | File |
|---|---|
| Auth controller | `src/modules/auth/auth.controller.ts` |
| Auth routes | `src/modules/auth/auth.routes.ts` |
| Joi validation schemas | `src/modules/auth/auth.validation.ts` |
| Token service | `src/shared/services/token.service.ts` |
| Email service | `src/shared/services/email.service.ts` |
| SMS service | `src/shared/services/sms.service.ts` |
| Auth middleware | `src/shared/middlewares/auth.middleware.ts` |
| Admin guard | `src/shared/middlewares/requireAdmin.middleware.ts` |

---

## 2. Registration Flow

**Endpoint:** `POST /api/auth/register`

1. **Input validation** (Joi `registerSchema`):
   - `email` — valid email format, required
   - `password` — minimum 8 characters, required
   - `phone` — optional string
   - `acceptedTerms` — must be `true`, required
   - `accountType` — `"individual"` or `"business"`, required
   - `businessName` — optional, only meaningful for business accounts
2. **Email uniqueness check** — returns 409 if already registered
3. **Password hashing** — bcrypt with 10 salt rounds
4. **Email verification token generation:**
   - `crypto.randomBytes(32)` produces a raw token (sent to user in the email)
   - The raw token is SHA-256 hashed and stored in `User.emailVerificationToken`
   - Expiry stored in `User.emailVerificationTokenExpiry` (24 hours from creation)
5. **User document inserted** with `isEmailVerified: false`
6. **Role assignment** — inserted into `UserRoles` collection:
   - `accountType === "business"` → `RoleId.SELLER (2)`
   - `accountType === "individual"` → `RoleId.CUSTOMER (3)`
7. **Verification email sent** (best-effort — failure does not block registration response)

---

## 3. Email Verification Flow

**Endpoint:** `POST /api/auth/confirm-email`

1. Raw token received from the verification link
2. Raw token is SHA-256 hashed and matched against `User.emailVerificationToken`
3. Token expiry checked (24-hour window)
4. On success:
   - `User.isEmailVerified` set to `true`
   - `emailVerificationToken` and `emailVerificationTokenExpiry` cleared from DB
   - Access token + refresh token issued immediately
5. **Redirect URL** in the response differs by account type:
   - `individual` → customer frontend URL
   - `business` → seller frontend URL (from `src/shared/constants/frontend.ts`)

**Related endpoints:**

- `POST /api/auth/resend-verification` — generates a new token, sends a fresh email. Always returns a generic success message (prevents email enumeration).
- `POST /api/auth/update-unverified-email` — only works for unverified accounts; accepts `currentEmail` + `newEmail`, updates email, and re-sends verification.

---

## 4. Login Flow

**Endpoint:** `POST /api/auth/login`

1. User fetched by email — not found → **401 UNAUTHORIZED**
2. bcrypt compare of provided password against `User.password` — mismatch → **401**
3. `User.isEmailVerified` checked — `false` → **403 FORBIDDEN** (with prompt to verify first)
4. Account `status` checked — `"blocked"` or `"suspended"` → **403 FORBIDDEN**
5. JWT access token + refresh token generated (see §5)
6. Refresh token hashed with bcrypt (10 rounds) → stored in `User.refreshTokenHash`
7. Both tokens returned in the response body

Step 2 is guarded: accounts created through Google Sign-In have no `password`
field, so they short-circuit at **400 BAD REQUEST** with a "continue with
Google" message rather than reaching bcrypt.

---

## 4b. Google Sign-In Flow

**Endpoint:** `POST /api/auth/google` — body `{ "idToken": "<Google ID token>" }`

The frontend obtains an ID token from Google Identity Services; the backend
verifies it and issues its *own* JWTs, so everything downstream is unchanged.
There is no redirect, no callback URL, and no client secret.

**There is no separate "register with Google" endpoint.** This one endpoint is
both sign-up and sign-in — a user who has never registered and clicks "Continue
with Google" gets an account created silently on the spot and is logged straight
in. They are never bounced to the register page, never asked to pick a password,
and never sent a verification email. From their point of view there is no
distinction between signing up and signing in; the `isNewUser` flag in the
response is the only signal, and exists so the frontend can show onboarding.

1. `verifyGoogleIdToken` (`src/shared/services/google-auth.service.ts`) verifies
   the token locally against Google's cached public keys: signature, `exp`,
   `iss`, and `aud` — which must equal `GOOGLE_CLIENT_ID` (or one of
   `GOOGLE_ADDITIONAL_CLIENT_IDS`). Any failure → **401**, with the real reason
   logged server-side only.
2. `email_verified === true` is required → otherwise **403**. This claim is what
   makes linking-by-email safe.
3. User resolved by `googleId` (the Google `sub`), then by email
   (case-insensitive):
   - **No match** → new user created: `authProvider: "google"`, `googleId`,
     `displayName`, `profilePicUrl`, `accountType: "individual"`,
     `status: "active"`, `acceptedTerms: true`, `isEmailVerified: true`, and
     **no `password` key at all**. A `UserRoles` row is inserted with
     `RoleID: 3` (CUSTOMER). A welcome email is sent fire-and-forget; there is
     no verification email — Google already proved the address.
   - **Email matches an existing password account** → auto-linked: `googleId`
     set, `isEmailVerified` forced to `true`, pending verification-token fields
     unset, `displayName`/`profilePicUrl` backfilled only if empty. Both
     credentials then coexist.
   - **`googleId` matches** → returning user.
4. `status` checked — `"blocked"` / `"suspended"` → **403**.
5. Access + refresh tokens issued exactly as in §5; `refreshTokenHash` updated.
6. Role rows are self-healing here — if the user somehow has none, CUSTOMER is
   inserted.

**200 response:** `{ token, refreshToken, userId, email, accountType, roles,
redirectTo, isNewUser, linked }` — the same shape as `/confirm-email` plus
`isNewUser` / `linked`, so the frontend can reuse its post-auth handler.
`redirectTo` is `postVerificationRedirect` if the user has one, otherwise
`/buyer/products` — unlike `/confirm-email`, business accounts are **not** sent
to GST onboarding here.

### What gets written to the database

Only four values ever come from Google: `sub`, `email`, `name`, `picture`.
Everything else below is set by us. The raw ID token is verified and discarded —
it is never stored, and no Google refresh token or access token is ever
requested or held.

**Case A — first-ever Google sign-in (no matching account).** A complete new
`Users` document:

```js
{
  _id:            ObjectId("..."),
  email:          "user@gmail.com",   // Google `email`, lowercased
  googleId:       "104928374651029384756",  // Google `sub`
  authProvider:   "google",
  displayName:    "Jane Doe",         // Google `name`   — omitted if absent
  profilePicUrl:  "https://lh3.googleusercontent.com/...",  // Google `picture`
  accountType:    "individual",
  status:         "active",
  acceptedTerms:  true,
  termsAcceptedAt: ISODate("..."),
  dateCreated:    ISODate("..."),
  isEmailVerified: true,              // Google asserted email_verified
  isPhoneVerified: false,
  refreshTokenHash: "$2b$10$...",     // bcrypt of the issued refresh JWT
  // NOTE: no `password` key at all — not null, not ""
}
```

Plus one `UserRoles` document: `{ UserRoleID: 3, UserID: <_id>, RoleID: 3 }`.

Fields deliberately **not** set: `password`, `phone`, `businessName`, `otp`,
`emailVerificationToken`, and every `seller*` field. They are absent, not null.

**Case B — Google email matches an existing password account (auto-link).**
No new document; the existing one is updated:

| Field | Action |
|---|---|
| `googleId` | set |
| `isEmailVerified` | forced to `true` |
| `refreshTokenHash` | replaced |
| `displayName` | set **only if** currently empty |
| `profilePicUrl` | set **only if** currently empty |
| `emailVerificationToken`, `emailVerificationTokenExpiry` | unset |

The existing `password`, `phone`, `accountType`, `businessName`, role rows and
seller status are all left untouched — a business/seller account that links
Google stays a business/seller account. Both credentials work from then on.

**Case C — returning Google user.** Only `refreshTokenHash` changes (plus the
idempotent `googleId` / `isEmailVerified` writes, which are no-ops).

**Local vs Google account, side by side:**

| Field | `/register` (local) | `/auth/google` |
|---|---|---|
| `password` | bcrypt hash | **absent** |
| `googleId` | absent | Google `sub` |
| `authProvider` | absent | `"google"` |
| `displayName` | absent (never collected) | Google `name` |
| `profilePicUrl` | absent until uploaded | Google `picture` |
| `isEmailVerified` | `false` until the email link is clicked | `true` immediately |
| `emailVerificationToken` | SHA-256 hash, 24h TTL | never set |
| `status` | **absent** (undefined) | `"active"` |
| `accountType` | from the request body | always `"individual"` |
| `acceptedTerms` | from the request body | always `true` |
| Role | SELLER if business, else CUSTOMER | always CUSTOMER |
| Welcome email | not sent (verification email instead) | sent |

> `status` being absent on locally-registered users is pre-existing behaviour —
> `authMiddleware` only blocks on the explicit values `"blocked"` / `"suspended"`,
> so `undefined` behaves as active. The Google path sets `"active"` explicitly.

Notes:
- Identity is keyed on `sub`, never on email alone — `sub` is stable and never
  reused, whereas a Google email can change.
- Only **ID tokens** are accepted. A Google *access* token (`ya29...`) is not
  audience-bound and must never be taken here.
- Sellers are not creatable via Google; business accounts still use `/register`.
- Running the password-reset flow on a Google-only account is supported and
  simply adds a password credential.

---

## 5. Token Generation & Lifecycle

All JWT operations live in `src/shared/services/token.service.ts`.

**Token payload:**
```json
{ "userId": "<ObjectId>", "email": "user@example.com" }
```

| Token | Method | Secret Env Var | Default Expiry | Stored in DB? |
|---|---|---|---|---|
| Access Token | `jsonwebtoken.sign` | `JWT_SECRET` (default: `"krono_square"`) | `JWT_EXPIRES_IN` (default: `15d`) | No — stateless |
| Refresh Token | `jsonwebtoken.sign` | `JWT_REFRESH_SECRET` (default: `"krono_square_refresh"`) | `JWT_REFRESH_EXPIRES_IN` (default: `30d`) | bcrypt hash in `User.refreshTokenHash` |
| Email Verification Token | `crypto.randomBytes` → SHA-256 | — | 24 hours (hard-coded) | SHA-256 hash in `User.emailVerificationToken` |
| Password Reset Token | `jsonwebtoken.sign` | `JWT_SECRET` | 10 minutes (hard-coded) | No |
| OTP | 6-digit random number | — | 10 minutes (hard-coded) | SHA-256 hash in `User.otp` |

**Token service functions:**

```typescript
signToken(payload: { userId, email }, expiresIn = "15d"): string
signRefreshToken(payload: { userId, email }): string
verifyToken(token: string): TokenPayload
verifyRefreshToken(token: string): TokenPayload
```

---

## 6. Token Refresh & Verification

**`POST /api/auth/verify-token`**
1. Attempts to verify the access token with `JWT_SECRET`
2. If **expired**: decodes it without verification to extract `userId`, then validates the provided refresh token:
   - Verify refresh token signature
   - bcrypt compare against `User.refreshTokenHash`
3. Issues a new access token if refresh is valid
4. Returns `{ user, roles, token }` on success

**`POST /api/auth/refresh-token`**
- Simpler flow: accepts only a refresh token, validates against DB hash, issues new access token
- Does not accept an expired access token — no decoding step

---

## 7. Password Reset Flow

### Step 1 — Request OTP

**`POST /api/auth/verify-email`** (email-based) or **`POST /api/auth/verify-phone`** (SMS-based)

1. User fetched by email or phone
2. 6-digit OTP generated (`Math.floor(Math.random() * 900000) + 100000`)
3. OTP SHA-256 hashed → stored in `User.otp`; expiry stored in `User.otpExpiry` (10 min)
4. Short-lived reset token (JWT, 10-min expiry) issued — contains `userId` — not stored in DB
5. OTP + reset link sent via email (`passwordResetOtp.template.ts`) or SMS (AWS SNS)
6. Response always returns a **generic success message** (prevents user enumeration)

### Step 2 — Submit new password

**`POST /api/auth/reset-password`**

1. Reset JWT verified → `userId` extracted
2. Provided OTP is SHA-256 hashed and compared against `User.otp`
3. `User.otpExpiry` checked — expired → **400**
4. New password hashed with bcrypt (10 rounds) → `User.password` updated
5. `User.otp` and `User.otpExpiry` cleared from DB

---

## 8. Email Sending

**Provider:** Gmail SMTP (`smtp.gmail.com`, port `587`, STARTTLS)  
**Service:** `src/shared/services/email.service.ts`  
**Templates:** `src/shared/email-templates/`

**Configuration env vars:**

| Variable | Purpose |
|---|---|
| `EMAIL_USER` | Sender Gmail address |
| `EMAIL_PASS` | Gmail app password (leading/trailing spaces stripped automatically) |
| `TLS_REJECT_UNAUTHORIZED` | Set to `false` in dev to allow self-signed certs |

**Email triggers:**

| Trigger | Template | Subject |
|---|---|---|
| New registration | `verifyEmail.template.ts` | "Verify your Krono² email address" |
| Resend verification | `verifyEmail.template.ts` | "Verify your Krono² email address" |
| Password reset (email OTP) | `passwordResetOtp.template.ts` | "Reset your Krono² password" |
| Admin blocks account | `accountStatus.template.ts` | Account blocked notification |
| Admin suspends account | `accountStatus.template.ts` | Account suspended notification |
| Admin restores account | `accountStatus.template.ts` | Account restored notification |

**SMS (phone OTP):**  
Provider: AWS SNS (`src/shared/services/sms.service.ts`)  
Config: `SMS_REGION`, `SMS_SENDER_ID`, `SMS_DLT_ENTITY_ID`, `SMS_DLT_TEMPLATE_ID_OTP`, `SMS_DLT_TEMPLATE_ID_RESET`  
Credentials: reuses `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`. Setup: [docs/accounts/aws/sns-sms.md](../docs/accounts/aws/sns-sms.md)

The OTP itself is generated and stored by the app (`user.otp` hashed, `user.otpExpiry`, `user.otpAttempts`) — SNS only delivers the text. Codes expire after 10 minutes and are voided after 5 wrong attempts.

---

## 9. Input Validation

Framework: **Joi**, applied via `validate.middleware.ts` before every auth controller.  
Errors are returned as **400 BAD_REQUEST** with per-field detail messages.

| Endpoint | Validation Rules |
|---|---|
| `/register` | `email` (valid format), `password` (min 8), `acceptedTerms: true`, `accountType: individual\|business` |
| `/login` | `email` (valid format), `password` (any string) |
| `/confirm-email` | `token` (required) |
| `/resend-verification` | `email` (valid format) |
| `/update-unverified-email` | `currentEmail` (valid format), `newEmail` (valid format) |
| `/verify-email` | `email` (valid format) |
| `/verify-phone` | `phone` (required string), `countryCode` (required) |
| `/reset-password` | `token` (required), `otp` (6-digit string), `newPassword` (min 8) |
| `/refresh-token` | `refreshToken` (required) |
| `/verify-token` | `token` (required), `refreshToken` (optional) |

---

## 10. User Data Storage

**Database:** MongoDB  
**Collection:** `Users`  
**Model:** `src/modules/users/user/user.types.ts`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `email` | string | Unique index |
| `password` | string? | bcrypt hash. **Absent on Google-created accounts** until the user runs the password-reset flow |
| `googleId` | string? | Google `sub` claim. Partial unique index. Presence = "can sign in with Google" |
| `authProvider` | `"local" \| "google"?` | Origin of the account. Informational only — never branch auth on it; absent on pre-existing rows |
| `displayName` | string? | Google `name` claim; local signup has no equivalent |
| `phone` | string? | Optional |
| `status` | `"active" \| "blocked" \| "suspended"` | Default: `"active"` |
| `isEmailVerified` | boolean | Login gate; starts as `false` |
| `emailVerificationToken` | string? | SHA-256 hash of raw token |
| `emailVerificationTokenExpiry` | Date? | 24h TTL; cleared after verification |
| `refreshTokenHash` | string? | bcrypt hash of latest refresh token |
| `otp` | string? | SHA-256 hash of 6-digit OTP |
| `otpExpiry` | Date? | 10-min TTL; cleared after use |
| `acceptedTerms` | boolean? | `true` at registration |
| `termsAcceptedAt` | Date? | Timestamp of T&C acceptance |
| `accountType` | `"individual" \| "business"` | Drives role assignment |
| `businessName` | string? | Business accounts only |
| `sellerVerificationStatus` | `"Unverified" \| "Pending" \| "Approved" \| "Rejected"` | Seller KYC flow |
| `sellerVerificationNote` | string? | Rejection reason from admin |
| `sellerVerifiedBy` | ObjectId? | Admin who changed the status |
| `sellerVerifiedAt` | Date? | Timestamp of status change |
| `profilePicUrl` | string? | URI |
| `dateCreated` | Date? | Creation timestamp |

**Indexes** — created at startup by `ensureIndexes()`
(`src/shared/database/ensureIndexes.ts`, called from `src/server.ts`):

| Index | Type | Why |
|---|---|---|
| `{ email: 1 }` | unique | Until this existed, uniqueness rested only on the app-level `findByEmail` check in `register()`, so concurrent signups could create duplicates. Google auto-linking makes a duplicate unrecoverable |
| `{ googleId: 1 }` | unique, partial (`googleId` is a string) | One Google account maps to at most one user. Partial rather than sparse so password-only accounts are unconstrained |

`ensureIndexes()` logs and continues on failure rather than crashing the server —
an existing collection with duplicate emails would otherwise make it unbootable.
Check before deploying with:

```js
db.Users.aggregate([{ $group: { _id: { $toLower: "$email" }, n: { $sum: 1 } } },
                    { $match: { n: { $gt: 1 } } }])
```

> Emails are stored as the user typed them. `findByEmail` is an exact match
> (unchanged), but the Google path uses `findByEmailInsensitive` so a local
> signup as `Foo@x.com` still links to the Google identity `foo@x.com`.

**Roles (`UserRoles` collection):**

| RoleID | Name | Assigned when |
|---|---|---|
| `1` | ADMIN | Manually assigned |
| `2` | SELLER | `accountType === "business"` at registration |
| `3` | CUSTOMER | `accountType === "individual"` at registration, and for every Google sign-up |

---

## 11. Auth Middleware & Guards

### `authMiddleware` — Required Authentication

File: `src/shared/middlewares/auth.middleware.ts`

1. Reads `Authorization: Bearer <token>` header — missing → **401**
2. Verifies JWT with `JWT_SECRET` — invalid/expired → **401**
3. Fetches user from DB by `userId` — not found → **401**
4. Checks `User.status` — `"blocked"` or `"suspended"` → **403**
5. Attaches `req.user = { userId, email }` and calls `next()`

### `optionalAuthMiddleware`

Same logic but **never rejects** — if the token is missing or invalid, `req.user` is simply not set and the request continues. Used for public product routes where auth enriches but doesn't gate access.

### `requireAdmin` — Admin Guard

File: `src/shared/middlewares/requireAdmin.middleware.ts`

- Must run **after** `authMiddleware` (depends on `req.user`)
- Queries `UserRoles` for the current user's roles
- Checks for `RoleID === 1` — not found → **403 FORBIDDEN**
- Applied to all `/api/admin/*` routes

---

## 12. Routes Summary

All routes under `/api/auth` — no authentication required on any auth route.

| Route | Method | Purpose |
|---|---|---|
| `/register` | POST | Create a new account |
| `/login` | POST | Login and receive access + refresh tokens |
| `/google` | POST | Sign in with a Google ID token; creates or links the account |
| `/confirm-email` | POST | Verify email address with the token from the email link |
| `/resend-verification` | POST | Re-send verification email |
| `/update-unverified-email` | POST | Change email before verification is complete |
| `/verify-email` | POST | Request password-reset OTP via email |
| `/verify-phone` | POST | Request password-reset OTP via SMS |
| `/reset-password` | POST | Submit OTP + reset token to set a new password |
| `/refresh-token` | POST | Exchange a valid refresh token for a new access token |
| `/verify-token` | POST | Validate an access token; auto-refresh if expired |

---

## 13. Security Notes

| Concern | Approach |
|---|---|
| Password storage | bcrypt, 10 salt rounds |
| Refresh token storage | bcrypt hash in DB — compromised DB doesn't leak usable tokens |
| Verification/OTP tokens | SHA-256 hash in DB — time-limited (24h / 10min) |
| Info leakage | Password reset and resend-verification always return generic messages |
| Account blocking | Enforced at middleware level on every authenticated request |
| Email verification gate | Login blocked until `isEmailVerified === true` |
| Admin elevation | Separate `requireAdmin` guard; not derivable from JWT alone |
| Google token trust | `aud` pinned to `GOOGLE_CLIENT_ID`; `email_verified === true` required before any account link; identity keyed on `sub`; ID tokens only, never access tokens |
| Email uniqueness | Unique index on `Users.email` + partial unique index on `Users.googleId`, created at startup by `ensureIndexes()` |
| CORS | Currently `*` — must be restricted to known frontend origins in production |
| Security headers | Helmet enabled |
