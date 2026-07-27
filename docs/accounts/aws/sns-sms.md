# AWS SNS — SMS / Mobile OTP Setup

Sends the phone-verification OTP over SMS. **Replaces Twilio** ([twilio.md](../twilio.md)) — one AWS account now covers storage (S3), email (SES), and SMS (SNS), sharing the same IAM user.

**Cost:** ~$0.00278 per SMS to India on the local (DLT) route — roughly **₹0.24 per OTP**. Verifying 10,000 sellers costs about **₹3,000**, versus ~₹1.34 lakh on Twilio Verify.

---

## Do this in two parts

**Part A gets SMS working to your own phone in about 30 minutes, with no DLT registration.** You don't have to wait on TRAI to start testing. Part B is what you need before real users, and it's mostly waiting.

| | What | Time |
|---|---|---|
| **[Part A](#part-a--working-today)** | IAM permission → sandbox number → send a test OTP | ~30 min, today |
| **[Part B](#part-b--production-access)** | DLT registration → sender ID → exit sandbox | 3–7 days + ~24h |

> Start [Step B1 (DLT registration)](#step-b1--register-with-trai-dlt) on day one even if you're still building — it's the long pole, and nothing else in Part B can start until you have the Entity ID.

---

## Prerequisites

- An AWS account with the app IAM user from [s3-setup.md](s3-setup.md) Step 4 (`kronosquare-app` in prod)
- A phone you can receive SMS on
- Optional but recommended: [AWS CLI](https://aws.amazon.com/cli/) configured with that IAM user (`aws configure`) — every console step below has a CLI equivalent

---

# Part A — Working Today

## Step A1 — About the Region (nothing to do)

**No action needed — this is already configured.** Read it so the later steps make sense.

SMS runs in **`ap-south-1`** (Mumbai). India local routes only work from `ap-south-1` or `ap-south-2` (Hyderabad); sending from `us-east-1` falls back to the international (ILDO) route — more expensive and heavily filtered by Indian carriers.

It's already set in two places:

- `SMS_REGION=ap-south-1` in `.env` and `.env.prod`
- the default in [env.ts](../../../src/shared/config/env.ts), used if the var is missing

**Your existing setup does not change.** Each service builds its own client with its own region:

| Service | Env var | Region |
|---------|---------|--------|
| S3 | `STORAGE_REGION` | `us-east-1` — unchanged |
| SES | `SES_REGION` | `us-east-1` — unchanged |
| SNS | `SMS_REGION` | `ap-south-1` |

Same AWS account, same IAM user, same access keys — just a different endpoint for SMS.

> ⚠️ **The one thing to watch:** the AWS Console's region selector (top right). It'll probably open on **N. Virginia** since that's where S3 and SES live. Everything SMS-related is **per region** — a sandbox number verified in `us-east-1` does nothing in Mumbai, and neither does a sender ID approved there.
>
> Before Steps A3, A6, B2 and B3, check the selector says **Asia Pacific (Mumbai) ap-south-1**. The CLI commands below all pass `--region ap-south-1` explicitly so they can't drift.
>
> Step A2 is the exception — IAM users and policies are global, so the selector doesn't matter there.

**Next action: [Step A2](#step-a2--grant-the-iam-user-sns-permission).**

---

## Step A2 — Grant the IAM User SNS Permission

Reuse the existing app IAM user — no new credentials, no new access keys.

**Attach it to the user whose access key is in the `.env` you're running.** Dev and prod are different IAM users (`skolo` for dev, `kronosquare-app` for prod) and each needs the permission separately — patching one does nothing for the other. If you're unsure which user a key belongs to:

```bash
aws sts get-caller-identity
```

The `Arn` ends in the username.

1. AWS Console → **IAM → Users** → open that user
2. **Permissions** tab → **Add permissions → Attach policies directly**
3. Search for and attach **`AmazonSNSFullAccess`**
4. Click **Add permissions**

Region doesn't matter — IAM is global. Changes take effect within seconds; no server restart needed.

**Tighter alternative for production** — instead of the managed policy, **Add permissions → Create inline policy → JSON**, paste this, name it `app-sms-send`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:GetSMSAttributes",
        "sns:SetSMSAttributes",
        "sns:GetSMSSandboxAccountStatus",
        "sns:CreateSMSSandboxPhoneNumber",
        "sns:VerifySMSSandboxPhoneNumber",
        "sns:ListSMSSandboxPhoneNumbers"
      ],
      "Resource": "*"
    }
  ]
}
```

> `sns:Publish` to a phone number has no ARN to scope to, so `"Resource": "*"` is expected. The four sandbox actions can be dropped once you're in production.

**✅ Checkpoint** — confirm the permission works:

```bash
aws sns get-sms-attributes --region ap-south-1
```

Returns an attributes object (possibly empty) rather than `AuthorizationError`. If you get `AuthorizationError`, the policy didn't attach to the user whose keys the CLI is using.

---

## Step A3 — Verify Your Phone in the SMS Sandbox

New AWS accounts are in the **SMS sandbox** — the same restriction that blocked you on the Twilio trial. You can only send to numbers you've verified, capped at $1.00/month.

**Check where you stand:**

```bash
aws sns get-sms-sandbox-account-status --region ap-south-1
```

`"IsInSandbox": true` means sandbox. Console equivalent: **SNS → Mobile → Text messaging (SMS)** → the **Account information** panel shows Status.

**Add your number — console:**

1. AWS Console → **SNS** → confirm the region selector says **Mumbai (ap-south-1)**
2. Navigation pane → **Mobile → Text messaging (SMS)**
3. Scroll to **Sandbox destination phone numbers** → **Add phone number**
4. Enter country code `+91` and your number, language English
5. **Add phone number** — AWS texts you a 6-digit OTP
6. Enter it in **Verification code** → **Verify phone number**

**Or CLI:**

```bash
aws sns create-sms-sandbox-phone-number \
  --phone-number +919876543210 \
  --language-code en-US \
  --region ap-south-1

# ... you receive an SMS with a code ...

aws sns verify-sms-sandbox-phone-number \
  --phone-number +919876543210 \
  --one-time-password 123456 \
  --region ap-south-1
```

**Sandbox limits worth knowing:**

- Up to **10** verified destination numbers
- OTP can be resent **5 times per 24 hours**
- Numbers can only be **deleted 24h** after the last verification attempt — so don't burn slots casually
- Status `Pending` after entering the code means verification *failed* (usually a wrong country code), not that it's still processing

**✅ Checkpoint:**

```bash
aws sns list-sms-sandbox-phone-numbers --region ap-south-1
```

Your number appears with `"Status": "Verified"`.

> If the OTP never arrives: your account spend limit may be $0, or the number was entered with a leading `0` after `+91`. See [Troubleshooting](#troubleshooting).

---

## Step A4 — Send a Test SMS Directly from AWS

Do this **before** touching the app. It separates "AWS isn't set up" from "the app has a bug" — worth the two minutes every time something breaks later.

```bash
aws sns publish \
  --phone-number +919876543210 \
  --message "123456 is your test code." \
  --message-attributes '{"AWS.SNS.SMS.SMSType":{"DataType":"String","StringValue":"Transactional"}}' \
  --region ap-south-1
```

**On Windows PowerShell**, the inline JSON quoting will fight you. Write it to a file instead:

```powershell
'{"AWS.SNS.SMS.SMSType":{"DataType":"String","StringValue":"Transactional"}}' | Out-File -Encoding ascii attrs.json
aws sns publish --phone-number +919876543210 --message "123456 is your test code." --message-attributes file://attrs.json --region ap-south-1
```

**✅ Checkpoint** — the command returns a `MessageId` **and** the SMS arrives.

A `MessageId` only means AWS accepted it, not that it was delivered. If you get an ID but no SMS, enable delivery logging ([Step A6](#step-a6--turn-on-delivery-logging)) — that is the only way to see carrier-side rejections.

> Without DLT registration this goes out on the international route. Delivery to Indian numbers is unreliable this way and the sender will show as a random number — fine for testing, not for production. That's what Part B fixes.

---

## Step A5 — Set Environment Variables

Add to `.env` (dev) and `.env.prod` (prod):

```env
SMS_REGION=ap-south-1
SMS_SENDER_ID=
SMS_DLT_ENTITY_ID=
SMS_DLT_TEMPLATE_ID_OTP=
SMS_DLT_TEMPLATE_ID_RESET=
```

**Leave the DLT vars blank for now.** The app omits any attribute that isn't set, so blank values send exactly what you tested in Step A4. Fill them in at [Step B4](#step-b4--fill-in-the-dlt-env-vars).

| Var | Required for Part A? | Where it comes from |
|-----|---|---------------------|
| `SMS_REGION` | Defaults to `ap-south-1` | Step A1 |
| `SMS_SENDER_ID` | No | Approved header, Step B2 |
| `SMS_DLT_ENTITY_ID` | No | PE ID, Step B1 |
| `SMS_DLT_TEMPLATE_ID_OTP` | No | Template ID, Step B1 |
| `SMS_DLT_TEMPLATE_ID_RESET` | No | Template ID, Step B1 |

Credentials come from `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` — the same IAM user as S3 and SES. There are no SMS-specific keys.

---

## Step A6 — Turn On Delivery Logging

Do this now, not when something breaks. Without it a carrier rejection is completely invisible — the API returns success and the SMS silently vanishes.

1. AWS Console → **SNS → Mobile → Text messaging (SMS)**
2. **Text messaging preferences** → **Edit**
3. Set **Default message type** to **Transactional**
4. Under **Delivery status logging**, set both **success** and **failure** sample rate to **100%**
5. IAM role: let the console **create a new service role**
6. **Save changes**

Logs appear in CloudWatch under `sns/<region>/<account-id>/DirectPublishToPhoneNumber`.

---

## Step A7 — Test Through the App

Both endpoints require authentication, so get a token first:

```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "YourPassword123!" }
```

Send the OTP — use the number you verified in Step A3:

```
POST http://localhost:5000/api/auth/send-mobile-otp
Authorization: Bearer <token from login>
Content-Type: application/json

{ "phone": "9876543210", "countryCode": "+91" }
```

Then verify it:

```
POST http://localhost:5000/api/auth/verify-mobile-otp
Authorization: Bearer <token from login>
Content-Type: application/json

{ "phone": "9876543210", "countryCode": "+91", "otp": "123456" }
```

**✅ Checkpoint** — you get `"Mobile number verified successfully"`, and in MongoDB the user document has `isPhoneVerified: true`, `phone: "+919876543210"`, and no `otp` / `otpExpiry` / `otpAttempts` fields.

> `phone` is sent **without** the country code (`9876543210`, not `+919876543210`) — the app joins them. A leading `0` or spaces are stripped automatically.

**Part A is done.** SMS works. Everything below is production hardening.

---

# Part B — Production Access

Two independent tracks that converge: **DLT registration** (B1, external, 3–7 days) and **exiting the AWS sandbox** (B3, ~24h). B2 needs B1 finished. Start B1 today.

---

## Step B1 — Register with TRAI DLT

Indian regulation requires every commercial SMS sender to register on a DLT (Distributed Ledger Technology) portal. **This is not an AWS step — AWS cannot do it for you, and no amount of AWS configuration substitutes for it.**

This step produces all four blank `SMS_*` values in your `.env`.

### What you're collecting

Each value depends on the one above it, which is why this takes days rather than an afternoon:

| Order | Value | Env var | Looks like |
|---|---|---|---|
| 1 | Principal Entity ID (PE ID) | `SMS_DLT_ENTITY_ID` | `1701234567890123456` (~19 digits) |
| 2 | Header | `SMS_SENDER_ID` | `KRONO2` (3–6 letters) |
| 3 | Content Template ID — verification | `SMS_DLT_TEMPLATE_ID_OTP` | `1707171234567890123` |
| 4 | Content Template ID — reset | `SMS_DLT_TEMPLATE_ID_RESET` | `1707171234567890124` |

### Before you start — documents and fees

Have these ready as scans; a missing document is the most common reason registration stalls:

- **PAN card** of the business
- **GST certificate** (or Udyam Registration / incorporation certificate if not GST-registered)
- **Letter of Authorisation (LoA)** on company letterhead, naming the authorised signatory
- **Authorised signatory's** PAN/Aadhaar, mobile number and email — both get OTP-verified during signup

**Fee:** ~**₹5,900** including GST for entity registration. Paid to the **telecom operator running the portal** (Vodafone Idea, Jio, Airtel, BSNL) — not to TRAI and not to AWS. It's a compliance levy: TRAI's TCCCPR 2018 mandated the DLT registry, and the carriers built and operate it.

Headers, content templates and URL whitelisting are **free** once the entity is approved, so this is the entire cost.

> ⚠️ **Check whether it's annual.** Vilpower bills ₹5,900 **per year**; some operators treat it as one-time. Confirm on the portal before paying — an unrenewed entity stops SMS delivery. This is separate from and additional to AWS SMS charges (~₹0.24/OTP).

**Timeline:** entity approval ~72 hours after payment clears; headers and templates typically 1–3 working days each after that. Budget a week end to end.

### 1. Pick a portal

Registration is **shared across all carriers** — your Entity ID, headers and templates propagate to every operator. You register on **one** portal and pay **one** fee; there's no benefit to registering on more.

- [Vodafone Idea (Vilpower)](https://www.vilpower.in) — most commonly used, best documented
- [Jio TrueConnect](https://trueconnect.jio.com)
- [Airtel DLT](https://dltconnect.airtel.in)
- [BSNL](https://www.ucc-bsnl.co.in)

### 2. Register as a Principal Entity

1. Sign up choosing **Principal Entity** / **Enterprise** (not Telemarketer — that's for SMS resellers)
2. Enter business PAN, plus the authorised signatory's mobile and email — both are OTP-verified
3. Upload the documents above
4. Pay the fee
5. Wait for approval (~72h), then log in

**→ You now have the `SMS_DLT_ENTITY_ID`.** It's shown on the entity dashboard as *Principal Entity ID* or *PE ID*.

### 3. Whitelist your domain — do this before templates

The password-reset SMS contains a link. **Templates carrying an unregistered URL are rejected**, and it's a slow round trip to find that out.

On the entity dashboard, find **URL/Domain whitelisting** (naming varies by portal) and register your `FRONTEND_URL` domain. Wait for it to be approved before submitting the reset template in step 5.

### 4. Register the Header

**Headers → Add Header** (sometimes called Sender ID).

| Field | Value |
|---|---|
| Header | `KRONO2` |
| Type | **Service Implicit** — see the trap below |
| Category | matches your business (e-commerce / retail) |

Rules: 3–6 characters, **letters only**, case-sensitive. Numeric headers are promotional and won't reach DND numbers.

**→ You now have the `SMS_SENDER_ID`.**

> ### ⚠️ The category trap — do not pick "Transactional"
>
> DLT's **Transactional** category is **reserved for banks** sending banking OTPs. It sounds like the obvious choice and it is the single most common rejection cause for non-bank OTP registrations. Krono² is e-commerce, so it doesn't qualify.
>
> Register as **Service Implicit** (some portals label it *Service Inferred*). It's the category for user-triggered informational messages including OTP, and critically **it delivers to DND-registered numbers** — which OTP must, since a large share of Indian users are on DND.
>
> Avoid **Service Explicit** too: it requires explicit marketing consent and does *not* reach DND numbers, so OTP delivery would silently collapse for those users.
>
> **This does not conflict with the AWS side.** AWS's `SMSType: Transactional` (Step B2, and what the code sends) is a different axis — it controls routing priority and delivery-hours treatment at AWS. DLT's category classifies the *content* with TRAI. `SMSType: Transactional` + DLT category `Service Implicit` is the correct, non-contradictory combination.

### 5. Register the two Content Templates

**Templates → Add Content Template**, twice. Use `{#var#}` for each variable.

**Phone verification** → `SMS_DLT_TEMPLATE_ID_OTP`
```
{#var#} is your Krono² verification code. It is valid for 10 minutes. Do not share this code with anyone.
```

**Password reset** → `SMS_DLT_TEMPLATE_ID_RESET`
```
{#var#} is your Krono² password reset code. It is valid for 10 minutes. Reset here: {#var#}
```

For each: select the same **Service Implicit** category, associate it with the `KRONO2` header, and submit.

**→ On approval you have both Template IDs.**

> ⚠️ **Template matching is byte-exact.** The SMS the app sends must match the registered template character for character — one extra space, changed punctuation, or different capitalisation and the carrier drops it silently, while AWS still reports success. This is the number one cause of "OTP never arrives" in production.
>
> **Copy the exact strings from the builders at the bottom of [sms.service.ts](../../../src/shared/services/sms.service.ts)** rather than retyping from this page. Note `Krono²` interpolates from `BRAND_NAME` — changing that env var changes the SMS and silently invalidates both registrations.

### 6. Put the values in `.env.prod`

See [Step B4](#step-b4--fill-in-the-dlt-env-vars). The header also has to be registered on the AWS side ([Step B2](#step-b2--register-the-sender-id-with-aws)) before it takes effect — DLT approval alone isn't enough.

### Why registrations get rejected

| Rejection | Cause |
|---|---|
| Header rejected — invalid format | Not 3–6 chars, or contains digits/symbols |
| Template rejected — category mismatch | Registered as **Transactional** as a non-bank. Use **Service Implicit**. |
| Template rejected — URL not allowed | Domain not whitelisted (step 3), or the portal disallows links in that category |
| Template rejected — insufficient content | Too little fixed text around the variables. Both templates above are comfortably long enough. |
| Template rejected — no brand name | Templates must identify the sender. `Krono²` covers this. |
| Approved but messages still blocked | Template not **associated with the header** — they're registered as a pair |
| Approved, delivers to some users only | Registered as **Service Explicit**, which skips DND numbers |

---

## Step B2 — Register the Sender ID with AWS

Needs the PE ID and Template IDs from B1.

1. AWS Console → **AWS End User Messaging** → confirm region is **`ap-south-1`**
2. **Configurations → Sender IDs → Request originator**
3. Country **India**, use case **Transactional**
4. Enter the approved header (e.g. `KRONO2`), your **PE ID**, and a **Template ID**
5. Submit

Transactional sender IDs are 3–6 **letters** and case-sensitive. Promotional ones are 6 digits — not what you want; promotional traffic is blocked during India's NDNC quiet hours (9pm–9am), which would break overnight signups.

> **"Transactional" here is AWS's term, not DLT's** — and they mean different things. AWS uses it for routing priority and delivery-hours treatment; DLT uses it for a bank-only content category you must *not* pick ([see the trap in B1](#step-b1--register-with-trai-dlt)).
>
> Correct combination: **AWS use case `Transactional`** + **DLT category `Service Implicit`**. Set them independently; they don't contradict.

> **SNS console vs AWS End User Messaging console:** since Sept 2024 SNS delivers SMS *through* AWS End User Messaging, and the two consoles overlap. Sandbox numbers, spend limit, and delivery logging live under **SNS → Mobile → Text messaging (SMS)**. Sender IDs and registrations live under **AWS End User Messaging**. Same underlying account and quotas.

---

## Step B3 — Exit the Sandbox and Raise the Spend Limit

AWS requires you to have verified and successfully messaged a sandbox number first — so [Part A](#part-a--working-today) is a genuine prerequisite, not just a warm-up.

1. **SNS → Mobile → Text messaging (SMS)** → **Account information** → **Exit SMS sandbox**

   This opens a Support case pre-set to **Service quota increase**.

2. Fill in the form:

   | Field | Value |
   |---|---|
   | Service | **SNS Text Messaging** |
   | Website / app name | your production URL |
   | Message type | **One Time Password** |
   | AWS Region | **ap-south-1** |
   | Countries | **India** |
   | Opt-in description | how users consent — e.g. "users enter their own phone number during seller signup and request the code explicitly" |
   | Message templates | paste both strings from B1 |

3. Under **Requests**:
   - Region: **ap-south-1**
   - Resource Type: **General Limits**
   - Quota: **Exit SMS Sandbox**
   - **Add another request** → Quota: **Account Spend Limit** → **New quota value**: `50` (USD/month — generous headroom for 10k sellers at ~$0.00278)

4. Submit. Initial response typically within 24 hours.

**Then apply the granted limit yourself** — AWS raising your ceiling does not raise your account's configured limit:

```bash
aws sns set-sms-attributes --attributes MonthlySpendLimit=50 --region ap-south-1
```

Or **SNS → Text messaging (SMS) → Preferences → Account spend limit**.

**✅ Checkpoint:**

```bash
aws sns get-sms-sandbox-account-status --region ap-south-1   # IsInSandbox: false
aws sns get-sms-attributes --region ap-south-1               # MonthlySpendLimit: 50
```

> ⚠️ Verify the spend limit **before** any bulk onboarding push. Hitting the cap mid-run drops messages silently — no exception, no retry, nothing in the API response.

---

## Step B4 — Fill in the DLT Env Vars

With B1 and B2 approved, complete `.env` / `.env.prod`:

```env
SMS_REGION=ap-south-1
SMS_SENDER_ID=KRONO2
SMS_DLT_ENTITY_ID=1234567890123456789
SMS_DLT_TEMPLATE_ID_OTP=9876543210987654321
SMS_DLT_TEMPLATE_ID_RESET=9876543210987654322
```

Restart the server and re-run [Step A7](#step-a7--test-through-the-app).

**✅ Checkpoint** — the SMS now arrives from `KRONO2` rather than a random number. That's the local route confirmed. Sender still showing as a number means the message fell back to international — check the sender ID is approved in `ap-south-1` and the template matches byte-exactly.

---

## Message Attributes (reference)

Set automatically by `buildAttributes()` in [sms.service.ts](../../../src/shared/services/sms.service.ts) — you never pass these by hand. Listed here for debugging.

| Attribute | Value | Sent when |
|-----------|-------|-----------|
| `AWS.SNS.SMS.SMSType` | `Transactional` | always |
| `AWS.SNS.SMS.SenderID` | `SMS_SENDER_ID` | when set |
| `AWS.MM.SMS.EntityId` | `SMS_DLT_ENTITY_ID` | when set |
| `AWS.MM.SMS.TemplateId` | `SMS_DLT_TEMPLATE_ID_OTP` or `_RESET` | when set |

---

## Cost Reference

| Route | Per SMS | 10,000 OTPs | 12,500 (with resends) |
|-------|---------|-------------|----------------------|
| India, local/DLT (`ap-south-1`) | $0.00278 | $27.80 | $34.75 (~₹3,000) |
| India, international fallback | significantly higher | — | — |
| US | $0.00645 | $64.50 | $80.63 |

Billed in USD — add ~2–3% forex on an Indian card. Compare: Twilio Verify was ~$0.133/OTP in India (~₹1.34 lakh for the same 12,500).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `AuthorizationErrorException: User ... is not authorized to perform: SNS:Publish` | Step A2 not applied, or applied to the wrong IAM user. The error names the user — attach `AmazonSNSFullAccess` to **that** one. Dev and prod are separate users. |
| Sandbox OTP never arrives | Spend limit may be $0 — `aws sns get-sms-attributes`. Or the number was entered with a leading `0` after `+91`. |
| Sandbox number stuck on `Pending` | Verification **failed**, usually a wrong country code. Re-add it — but note you can't delete it for 24h. |
| `MessageId` returned but no SMS | Accepted by AWS, dropped by carrier. Enable delivery logging (Step A6) and read the CloudWatch entry — this is the only way to see the reason. |
| OTP never arrives in production, no error | Template mismatch — the sent string must match the DLT template byte for byte. Compare against the builders in `sms.service.ts`. |
| SMS arrives from a random number, not `KRONO2` | Fell back to the international route. Sender ID not approved in `ap-south-1`, or template mismatch. |
| `InvalidParameterException: sender ID` | Sender ID not approved in **this region**, or lowercase (transactional IDs are case-sensitive) |
| Messages only reach your own number | Still in the sandbox — Step B3 |
| Delivery stops abruptly mid-batch | Monthly spend limit hit — Step B3 |
| Messages blocked 9pm–9am IST | AWS sender ID registered as `Promotional`; must be `Transactional` |
| Delivers to some users, never to others | DLT category is **Service Explicit**, which skips DND-registered numbers. Re-register as **Service Implicit** — Step B1. |
| DLT registration rejected as a non-bank | Category set to **Transactional**, which is bank-only. Use **Service Implicit**. |
| `Invalid parameter: PhoneNumber` | Not E.164. The app strips leading `0` and spaces, but check `countryCode` is being sent. |
| DLT template approved but still blocked | Template ID must be **associated with the sender ID** you send from — they're registered as a pair |
| Everything worked, then broke after an env change | Did `BRAND_NAME` or `FRONTEND_URL` change? Both alter the SMS text and invalidate the DLT template match. |

---

## OTP Lifecycle

SNS only delivers text, so the app owns the OTP. The mobile flow reuses the same user fields as the email reset flow:

| Field | Purpose |
|-------|---------|
| `user.otp` | SHA-256 hash of the 6-digit code |
| `user.otpExpiry` | Now + `OTP_TTL_MS` (10 minutes) |
| `user.otpAttempts` | Wrong-guess counter |

`POST /send-mobile-otp` writes all three (attempts reset to 0) and sends. `POST /verify-mobile-otp` compares the hash, and on success sets `isPhoneVerified` plus the verified `phone`, then clears all three.

**Attempt cap:** 5 wrong guesses voids the OTP (`MAX_OTP_ATTEMPTS` in [auth.controller.ts](../../../src/modules/auth/auth.controller.ts)). Twilio Verify enforced this server-side; with SNS it's ours, and without it a stored 6-digit hash is trivially brute-forceable.

**No per-user send rate limit yet** — nothing stops a client calling `/send-mobile-otp` in a loop, and every call costs money. Add throttling at the route or gateway before opening signups to volume.

---

## Code References

| File | Purpose |
|------|---------|
| `src/shared/services/sms.service.ts` | `sendSMS()` / `sendMobileOTP()` / `sendPasswordResetSMS()` — SNS wrapper + DLT message builders |
| `src/shared/utils/otp.ts` | `generateOTP()` / `hashOTP()` — shared with the email flow |
| `src/modules/auth/auth.controller.ts` | `sendMobileOTP` / `verifyMobileOTP` / `verifyPhone` handlers |
| `src/modules/auth/auth.routes.ts` | `POST /send-mobile-otp`, `POST /verify-mobile-otp` |
| `src/modules/users/user/user.types.ts` | `otp` / `otpExpiry` / `otpAttempts` fields |
| `src/shared/config/env.ts` | `SMS_*` env var definitions |

---

Next: [s3-setup.md](s3-setup.md) · [ses-dev.md](ses-dev.md) · [ses-prod.md](ses-prod.md) · back to [README](README.md)
