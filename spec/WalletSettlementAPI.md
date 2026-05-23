# Harmoniv Time — Seller Wallet, Earnings & Payouts API

**Version:** 1.0.0 | **Status:** Active | **Audience:** Frontend developers

> Integration reference for the **seller wallet / settlement** feature: viewing earnings from
> sold items, managing bank accounts, requesting withdrawals, and (for admins) processing
> payouts. Endpoint/method/shape claims are taken from the route, validation, controller and
> repository files under `src/modules/wallet/**`.
>
> All paths are relative to the API base (`/api`). Read alongside `FrontendIntegration.md`
> (auth, conventions, response envelope).

---

## 1. Conventions (recap)

```
Base URL:      http://<host>:<port>/api
Content-Type:  application/json
Authorization: Bearer <JWT>     ← REQUIRED on every endpoint in this doc
```

- **Response envelope:** `{ "message": string, "data": object | array | null }`.
- **Seller identity comes from the JWT**, never from the URL or body. Whoever the token belongs
  to is the seller — there is no `sellerId` path/query param.
- All `*ID` fields are MongoDB ObjectId strings. Dates are ISO 8601 strings.
- **Money:** all amounts (`GrossAmount`, `NetAmount`, `Amount`, balances) are in the **same unit
  as the product's listed `Price`**. Render with your existing product-price formatter.

### How the wallet works (mental model)

1. When a buyer's payment is verified, the backend creates one **earning** per sold product:
   `NetAmount = Price − commission`. It starts as **`Pending`**.
2. After the seller's shipment for that order is **`Delivered`** and a **hold window**
   (default 7 days) passes, the earning flips to **`Available`** (withdrawable).
3. The seller requests a **withdrawal** → all `Available` earnings are locked (**`Requested`**)
   into a payout request.
4. An admin deposits the money externally and marks it **Paid** → those earnings become
   **`Settled`**. (Reject/cancel returns them to `Available`.)

Earning status → wallet bucket:

| Earning `Status` | Wallet bucket | Meaning |
|------------------|---------------|---------|
| `Pending`   | `pendingBalance`   | Sold, not yet withdrawable (awaiting delivery + hold) |
| `Available` | `availableBalance` | Withdrawable now |
| `Requested` | `inProcessBalance` | Locked in a pending withdrawal |
| `Settled`   | `totalWithdrawn`   | Paid out (historical) |

---

## 2. Wallet

### 2.1 Get wallet summary — `GET /api/wallet`

Headers: `Authorization: Bearer <token>`. No body.

Success `200`:
```json
{
  "message": "Wallet retrieved successfully",
  "data": {
    "availableBalance": 27000,
    "pendingBalance": 9000,
    "inProcessBalance": 0,
    "totalWithdrawn": 18000,
    "totalEarned": 54000,
    "counts": { "available": 3, "pending": 1, "inProcess": 0, "settled": 2 }
  }
}
```

Errors: `401` (missing/invalid token).

**FE note:** This is the wallet dashboard. Show `availableBalance` as the headline "withdrawable"
figure and enable the Withdraw button when it's `> 0`. `pendingBalance` = "on the way / clearing".
`counts` lets you badge each tab. Values are recomputed live (eligibility is refreshed on each call).

---

### 2.2 Get wallet items — `GET /api/wallet/items`

Itemized sold products behind the balances. Optional `status` query filter.

```
GET /api/wallet/items                 → all items
GET /api/wallet/items?status=available
GET /api/wallet/items?status=pending
GET /api/wallet/items?status=requested
GET /api/wallet/items?status=settled
```

`status` is case-insensitive (`available` == `Available`).

Success `200`:
```json
{
  "message": "Wallet items retrieved successfully",
  "data": [
    {
      "_id": "6650a1...e01",
      "ProductID": "6648f2...a90",
      "CheckoutID": "664a77...b12",
      "WithdrawalID": null,
      "Status": "Available",
      "GrossAmount": 10000,
      "CommissionAmount": 1000,
      "NetAmount": 9000,
      "SaleDate": "2026-05-01T10:30:00.000Z",
      "AvailableAt": "2026-05-12T09:00:00.000Z",
      "ProductName": "Omega Seamaster",
      "ImageURL": "https://.../primary.jpg"
    }
  ]
}
```

Notes:
- `AvailableAt` is `null` until the item becomes `Available`.
- `WithdrawalID` is set once the item is locked into a withdrawal (`Requested`/`Settled`) — use it
  to link a settled item back to its payout.

Errors: `400 "Invalid status filter"` (unknown status value), `401`.

**FE note:** Drive the "Sold items" list / wallet breakdown table from this. Filter tabs map 1:1 to
the `status` values. `status=settled` is the per-item payout history.

---

## 3. Bank accounts (payout destinations)

### 3.1 Add bank account — `POST /api/bank-accounts`

Request:
```json
{
  "AccountHolderName": "Jane Doe",      // required
  "AccountNumber": "123456789012",      // required, 6–18 digits
  "IFSC": "HDFC0001234",                // required, valid IFSC (4 letters, 0, 6 alphanumerics)
  "BankName": "HDFC Bank",              // required
  "IsDefault": true                      // optional; first account is default automatically
}
```

Success `201`:
```json
{
  "message": "Bank account added successfully",
  "data": { "acknowledged": true, "insertedId": "6651bb...c34" }
}
```

Errors: `400` validation (e.g. `"Invalid IFSC code"`, `"AccountNumber must be 6-18 digits"`), `401`.

**FE note:** `IFSC` is uppercased server-side. If `IsDefault: true`, the previous default is cleared
automatically (only one default at a time). The very first account added becomes default even if you
omit the flag.

---

### 3.2 List bank accounts — `GET /api/bank-accounts`

Success `200`:
```json
{
  "message": "Bank accounts retrieved successfully",
  "data": [
    {
      "_id": "6651bb...c34",
      "SellerID": "6648aa...111",
      "AccountHolderName": "Jane Doe",
      "AccountNumber": "123456789012",
      "IFSC": "HDFC0001234",
      "BankName": "HDFC Bank",
      "IsDefault": true,
      "CreatedAt": "2026-05-20T08:00:00.000Z"
    }
  ]
}
```

Returns only the authenticated seller's accounts. Errors: `401`.

**FE note:** Use the `IsDefault` account as the pre-selected destination on the withdrawal screen.

---

### 3.3 Update bank account — `PUT /api/bank-accounts/:accountID`

Request (any subset; at least one field):
```json
{ "BankName": "HDFC Bank Ltd", "IsDefault": true }
```

Success `200 { "message": "Bank account updated successfully", "data": null }`.

Errors: `400` validation / invalid id, `404 "Bank account not found"` (also when it isn't yours), `401`.

**FE note:** Setting `IsDefault: true` clears the default on the seller's other accounts.

---

### 3.4 Delete bank account — `DELETE /api/bank-accounts/:accountID`

Success `200 { "message": "Bank account deleted successfully", "data": null }`.

Errors: `400` invalid id, `404 "Bank account not found"`, `401`.

---

## 4. Withdrawals (seller side)

### 4.1 Request a withdrawal — `POST /api/withdrawals`

Withdraws **all currently-available funds** to the chosen bank account. The amount is computed
server-side from available earnings — you do **not** send an amount.

Request:
```json
{ "BankAccountID": "6651bb...c34" }   // required; must be one of the seller's accounts
```

Success `201`:
```json
{
  "message": "Withdrawal requested successfully",
  "data": {
    "_id": "6652cc...d77",
    "Amount": 27000,
    "ItemCount": 3,
    "Status": "Pending"
  }
}
```

Errors:
- `400 "Invalid BankAccountID"` — malformed id.
- `400 "Bank account not found"` — id isn't one of the seller's accounts.
- `400 "No funds available to withdraw"` — `availableBalance` is 0.
- `401`.

**FE note:** After a `201`, refresh `GET /api/wallet` — `availableBalance` drops to 0 and
`inProcessBalance` rises by `Amount`. Disable the Withdraw button while available is 0.

---

### 4.2 List my withdrawals — `GET /api/withdrawals`

Optional `?status=` filter: `Pending` | `Approved` | `Paid` | `Rejected` (exact case).
This is the seller's **payout history**.

```
GET /api/withdrawals              → all
GET /api/withdrawals?status=Paid  → completed payouts only
```

Success `200`:
```json
{
  "message": "Withdrawals retrieved successfully",
  "data": [
    {
      "_id": "6652cc...d77",
      "SellerID": "6648aa...111",
      "BankAccountID": "6651bb...c34",
      "BankSnapshot": {
        "AccountHolderName": "Jane Doe",
        "AccountNumber": "123456789012",
        "IFSC": "HDFC0001234",
        "BankName": "HDFC Bank"
      },
      "Amount": 27000,
      "EarningIDs": ["6650a1...e01", "6650a1...e02", "6650a1...e03"],
      "Status": "Paid",
      "Reference": "UTR1234567890",
      "ProcessedAt": "2026-05-22T11:00:00.000Z",
      "ProcessedBy": "6600ad...999",
      "RequestedAt": "2026-05-20T09:30:00.000Z"
    }
  ]
}
```

Notes:
- `BankSnapshot` is the bank detail captured **at request time** (stays accurate even if the
  account is later edited/deleted).
- `Reference` (bank UTR/txn id) and `ProcessedAt`/`ProcessedBy` are present only once `Paid`.
- `Notes` appears on `Rejected` (and optionally on `Paid`).

Errors: `401`.

**FE note:** Render this as the payouts history table. Status chips: `Pending` (awaiting admin),
`Paid` (show `Reference`), `Rejected` (show `Notes`).

---

### 4.3 Cancel a withdrawal — `PUT /api/withdrawals/:withdrawalID/cancel`

Only allowed while `Pending`. Releases the locked earnings back to `Available` and removes the
request.

Success `200 { "message": "Withdrawal cancelled successfully", "data": null }`.

Errors:
- `400 "Invalid withdrawal id"`.
- `400 "Only pending withdrawals can be cancelled"`.
- `404 "Withdrawal not found"` (also when it isn't yours).
- `401`.

**FE note:** After cancel, the funds reappear in `availableBalance`.

---

## 5. Withdrawals (admin side)

> **Admin only.** Requires a token whose user has the **ADMIN (RoleId 1)** role. Non-admins get
> `403 "Admin access required"`.

### 5.1 List all withdrawals — `GET /api/admin/withdrawals`

Optional `?status=Pending` (or `Approved` / `Paid` / `Rejected`). Returns withdrawals across all
sellers. Same object shape as §4.2.

```
GET /api/admin/withdrawals?status=Pending   → the payout queue
```

Success `200 { "message": "Withdrawals retrieved successfully", "data": [ ...withdrawals ] }`.

Errors: `401`, `403 "Admin access required"`.

---

### 5.2 Mark a withdrawal Paid — `PUT /api/admin/withdrawals/:withdrawalID/pay`

Call after the money has been deposited to the seller's bank externally. Settles the covered
earnings.

Request:
```json
{
  "Reference": "UTR1234567890",   // required — bank UTR / transaction id
  "Notes": "Paid via NEFT"        // optional
}
```

Success `200 { "message": "Withdrawal marked as paid", "data": null }`.

Errors:
- `400 "Invalid withdrawal id"`.
- `400 "Cannot pay a Paid withdrawal"` / `"Cannot pay a Rejected withdrawal"` — wrong state
  (only `Pending`/`Approved` can be paid).
- `404 "Withdrawal not found"`.
- `401`, `403`.

**FE note:** On success the withdrawal becomes `Paid` and its items move to `Settled` (they show in
the seller's `totalWithdrawn` / `?status=settled`).

---

### 5.3 Reject a withdrawal — `PUT /api/admin/withdrawals/:withdrawalID/reject`

Releases the locked earnings back to the seller's `Available` balance.

Request:
```json
{ "Notes": "Bank details could not be verified" }   // required
```

Success `200 { "message": "Withdrawal rejected", "data": null }`.

Errors:
- `400 "Invalid withdrawal id"`.
- `400 "Cannot reject a Paid withdrawal"` — wrong state (only `Pending`/`Approved`).
- `404 "Withdrawal not found"`.
- `401`, `403`.

---

## 6. Typical frontend flows

### Seller wallet screen
1. `GET /api/wallet` → render balances + Withdraw button (enabled when `availableBalance > 0`).
2. Tabs → `GET /api/wallet/items?status=...` for the itemized breakdown.
3. `GET /api/bank-accounts` → destination dropdown (preselect `IsDefault`).
4. Withdraw → `POST /api/withdrawals { BankAccountID }` → re-fetch `GET /api/wallet`.
5. History tab → `GET /api/withdrawals` (chips by `Status`).

### Admin payouts screen
1. `GET /api/admin/withdrawals?status=Pending` → queue.
2. After depositing → `PUT /api/admin/withdrawals/:id/pay { Reference }`.
3. Or → `PUT /api/admin/withdrawals/:id/reject { Notes }`.

---

## 7. Config affecting amounts (backend, FYI)

| Env var | Default | Effect |
|---------|---------|--------|
| `PLATFORM_COMMISSION_RATE` | `0.1` (10%) | `NetAmount = Price − round(Price × rate)` |
| `PAYOUT_HOLD_DAYS` | `7` | Days after delivery before an earning becomes `Available` |

These are snapshotted onto each earning at sale time, so changing them does not rewrite history.
