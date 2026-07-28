# Google Sign-In — Account Setup Guide

Used for: "Continue with Google" on the login and register pages.
**Completely free.** No billing account, no quota, no paid tier.

> Why only a client ID and no secret?
> We use the **ID-token flow**: the frontend gets a signed token from Google and
> posts it to `POST /api/auth/google`; the backend verifies that signature
> offline against Google's public keys. There is no redirect, no authorization
> code, and therefore no client secret. If a guide tells you to copy a client
> secret, it is describing the *other* (server-side redirect) flow — you don't
> need it here.

---

## Step 1 — Create a Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with the Google account that should own the credentials — use a
   **company account**, not a personal one. Whoever owns this project controls
   sign-in for the whole app.
3. Click the project dropdown at the top → **New Project**
4. Name it (e.g. `krono-square`) → **Create**
5. Make sure the new project is selected in the dropdown before continuing

No APIs need to be enabled. Sign-In works out of the box.

---

## Step 2 — Configure the Google Auth Platform

> **Note on the console UI.** Google replaced the old single "OAuth consent
> screen" page with **Google Auth Platform** in 2025. Older guides (including
> most blog posts) describe the previous layout. The settings are the same —
> they're just split across the left-nav sections **Branding**, **Audience**,
> **Clients**, and **Data access**.

1. Left sidebar → **APIs & Services → OAuth consent screen**. If the project has
   never been configured you'll land on **Google Auth Platform → Overview**
   showing *"Google auth platform not configured yet"*. Click **Get started**.
2. **App Information**
   - **App name** — `Krono²` (this is what users see on the consent dialog)
   - **User support email** — pick your address from the dropdown

   → **Next**
3. **Audience** — choose **External** (Internal is only available on Google
   Workspace and restricts sign-in to your own organisation) → **Next**
4. **Contact Information** — your email address, for Google's notifications
   about the project → **Next**
5. Tick **I agree to the Google API Services: User Data Policy** → **Continue**
   → **Create**

The left-nav sections are now active. Two of them need attention:

### Data access — scopes

**Data access** → **Add or remove scopes** → tick exactly these three:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

→ **Update** → **Save**

> Do not add anything else. These three are "non-sensitive" and need no Google
> review. The moment you add a sensitive scope (Gmail, Drive, Calendar) the app
> has to go through a verification process that takes weeks.

### Audience — test users and publishing

While **Publishing status** is **Testing**, only accounts listed under **Test
users** can sign in; everyone else gets `Error 403: access_denied`.

- **Audience** → **Add users** → add your own Gmail address for now
- Before launch: **Audience** → **Publish app** → confirm

With only the three scopes above, publishing is **instant** — no review, no
waiting.

### Branding — optional

**Branding** holds the app logo, home page, privacy policy and terms URLs, and
authorized domains. Fill in the URLs (your `FRONTEND_URL` plus `/privacy` and
`/terms`) when you have those pages. **Skip the logo** — uploading one triggers
a Google review that isn't otherwise required.

---

## Step 3 — Create the OAuth Client ID

1. Left sidebar → **Google Auth Platform → Clients** (this replaces the old
   *APIs & Services → Credentials → Create Credentials → OAuth client ID*;
   the Credentials page still works and shows the same clients)
2. **Create client**
3. Application type: **Web application**
4. Name: `krono-square-web` (internal label only, users never see it)
5. **Authorized JavaScript origins** — click **Add URI** for each. Origin only:
   scheme + host + port, **no path, no trailing slash**:

   ```
   http://localhost:4200
   https://krono-square.pages.dev
   https://krono2.com
   ```

   > This list is the real security boundary. Google will only hand a token to
   > a page served from one of these origins. Add every environment the
   > frontend runs on — local, staging, production, and any preview domain.

6. **Authorized redirect URIs** — leave **empty**. The ID-token flow never
   redirects.
7. **Create**
8. A dialog shows **Client ID** and **Client secret**. Copy the **Client ID**:

   ```
   81234567890-a1b2c3d4e5f6g7h8.apps.googleusercontent.com
   ```

   **Ignore the client secret.** Don't put it in `.env`, don't store it
   anywhere. This flow doesn't use one.

You can reopen the client later from **Clients** to copy the ID again or edit
the origins — nothing is shown only once.

---

## Step 4 — Set Environment Variables

Add to your `.env` (already stubbed out in the file):

```env
GOOGLE_CLIENT_ID=81234567890-a1b2c3d4e5f6g7h8.apps.googleusercontent.com
GOOGLE_ADDITIONAL_CLIENT_IDS=
```

- `GOOGLE_CLIENT_ID` — the Client ID from Step 3. **Required.** Without it,
  `POST /api/auth/google` returns 500 `"Google Sign-In is not configured"`.
- `GOOGLE_ADDITIONAL_CLIENT_IDS` — leave empty. See "Adding a mobile app" below.

The **same Client ID** must also go into the frontend
(`src/environments/environment*.ts` → `googleClientId`). The two must match, or
every sign-in fails with a 401: the backend requires the token's `aud` claim to
equal `GOOGLE_CLIENT_ID`.

### Is the Client ID a secret?

No. It ships inside the frontend JavaScript bundle and is visible to anyone.
That is by design — it's an identifier, not a credential. Security comes from
the JavaScript-origins allowlist (Step 3.5) plus the backend's `aud` check.
It still lives in `.env` so it can differ between staging and production.

### Staging vs Production

Use a **separate Google Cloud project** (and therefore a separate Client ID)
for staging. One project with every origin mixed in works, but then a mistake
in a staging origin affects production sign-in.

---

## Step 5 — Test It

With the server running (`npm run dev`) and `GOOGLE_CLIENT_ID` set:

1. Open the frontend, click **Continue with Google**, pick an account.
2. Expected: a `200` from `POST /api/auth/google` with
   `{ token, refreshToken, userId, email, roles, redirectTo, isNewUser, linked }`.
3. Check MongoDB — the `Users` document should have `googleId`,
   `authProvider: "google"`, `isEmailVerified: true`, and **no `password`
   field**. A matching `UserRoles` row should exist with `RoleID: 3`.

To test the backend on its own without the frontend, mint a real ID token from
the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):

1. Gear icon (top right) → tick **Use your own OAuth credentials** → paste your
   Client ID **and** client secret (the Playground needs the secret; your app
   does not).
2. In Google Cloud Console, temporarily add
   `https://developers.google.com/oauthplayground` to **Authorized redirect
   URIs** on that client.
3. In the Playground, select scopes `openid`, `email`, `profile` → **Authorize
   APIs** → **Exchange authorization code for tokens**.
4. Copy the **`id_token`** value (not `access_token`) and:

```bash
curl -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"PASTE_ID_TOKEN_HERE"}'
```

ID tokens expire after **1 hour**. Remove the Playground redirect URI when done.

---

## Adding a Mobile App Later

Android and iOS apps each need their **own** OAuth client (Android requires the
SHA-1 fingerprint of your signing certificate; iOS requires the bundle ID).
Tokens they mint carry *their* client ID in the `aud` claim, so the backend must
be told to accept them:

```env
GOOGLE_ADDITIONAL_CLIENT_IDS=<android-client-id>,<ios-client-id>
```

> Only ever list client IDs from **your own** Google Cloud project. Adding a
> third party's client ID would let their app's tokens sign in as your users.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 500 `Google Sign-In is not configured` | `GOOGLE_CLIENT_ID` is empty in `.env`, or the server wasn't restarted after setting it |
| 401 `Invalid or expired Google token` | Check the server logs — the real reason is logged at WARN level. Usually the frontend's `googleClientId` doesn't match the backend's `GOOGLE_CLIENT_ID`, or the token is over an hour old |
| `Error 400: origin_mismatch` in the Google popup | The page's origin isn't in **Authorized JavaScript origins**. It must match exactly — `http` vs `https`, port included, no trailing slash |
| `Error 403: access_denied` | Publishing status is still **Testing** and this account isn't a test user. **Audience** → add it under Test users, or **Publish app** |
| Console shows *"Google auth platform not configured yet"* | The project has no auth config — click **Get started** and complete Step 2 |
| Can't find "OAuth consent screen" / "Create Credentials" | Google renamed these to **Google Auth Platform**. Scopes are under **Data access**, test users and publishing under **Audience**, client IDs under **Clients** |
| 403 `Your Google account email is not verified` | Rare — the Google account itself has an unverified address. The user must verify it with Google first |
| Google button doesn't render at all | The GSI script (`https://accounts.google.com/gsi/client`) isn't loaded in `index.html`, or it's blocked by an ad blocker |
| Sign-in works but the app doesn't react | The GSI callback fires outside Angular's zone — wrap the handler in `ngZone.run()` |
| Changes to origins don't take effect | Google can take a few minutes to propagate; also hard-refresh the frontend |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/services/google-auth.service.ts` | `verifyGoogleIdToken()` — verifies the token, pins `aud` to `GOOGLE_CLIENT_ID` |
| `src/modules/auth/auth.controller.ts` | `googleSignIn` — creates or links the account and issues our JWTs |
| `src/modules/auth/auth.routes.ts` | `POST /api/auth/google` |
| `src/shared/config/env.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_ADDITIONAL_CLIENT_IDS` |
| `src/shared/database/ensureIndexes.ts` | Unique index on `Users.email`, partial unique index on `Users.googleId` |
| `spec/Authentication.md` §4b | Full flow spec — account linking rules, response shapes, security notes |
