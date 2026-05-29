# Authentication System — Technical Spec

**Version:** 1.0.0 | **Status:** Active | **Audience:** Developers & Reviewers

> This document covers how authentication works end-to-end in the Harmonic Time backend —
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

---

## 5. Token Generation & Lifecycle

All JWT operations live in `src/shared/services/token.service.ts`.

**Token payload:**
```json
{ "userId": "<ObjectId>", "email": "user@example.com" }
```

| Token | Method | Secret Env Var | Default Expiry | Stored in DB? |
|---|---|---|---|---|
| Access Token | `jsonwebtoken.sign` | `JWT_SECRET` (default: `"harmonic_time"`) | `JWT_EXPIRES_IN` (default: `15d`) | No — stateless |
| Refresh Token | `jsonwebtoken.sign` | `JWT_REFRESH_SECRET` (default: `"harmonic_time_refresh"`) | `JWT_REFRESH_EXPIRES_IN` (default: `30d`) | bcrypt hash in `User.refreshTokenHash` |
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
5. OTP + reset link sent via email (`passwordResetOtp.template.ts`) or SMS (Twilio)
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
| New registration | `verifyEmail.template.ts` | "Verify your Harmonic Time email address" |
| Resend verification | `verifyEmail.template.ts` | "Verify your Harmonic Time email address" |
| Password reset (email OTP) | `passwordResetOtp.template.ts` | "Reset your Harmonic Time password" |
| Admin blocks account | `accountStatus.template.ts` | Account blocked notification |
| Admin suspends account | `accountStatus.template.ts` | Account suspended notification |
| Admin restores account | `accountStatus.template.ts` | Account restored notification |

**SMS (phone OTP):**  
Provider: Twilio (`src/shared/services/sms.service.ts`)  
Config: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

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
| `password` | string | bcrypt hash |
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

**Roles (`UserRoles` collection):**

| RoleID | Name | Assigned when |
|---|---|---|
| `1` | ADMIN | Manually assigned |
| `2` | SELLER | `accountType === "business"` at registration |
| `3` | CUSTOMER | `accountType === "individual"` at registration |

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
| CORS | Currently `*` — must be restricted to known frontend origins in production |
| Security headers | Helmet enabled |
