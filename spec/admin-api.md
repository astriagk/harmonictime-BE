# Harmonic Time — Admin API Reference

All admin routes require:
- `Authorization: Bearer <token>` header (authenticated session)
- The caller's account must have `RoleID: 1` (Admin) in `UserRoles`

Base URL: `/api`

---

## Customer Management

### List Customers
```
GET /api/admin/users
```
Query params:

| Param | Type | Description |
|-------|------|-------------|
| `status` | `active \| blocked \| suspended` | Filter by account status (omit for all) |

**Response 200**
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "email": "buyer@example.com",
      "phone": "+919876543210",
      "status": "active",
      "dateCreated": "2024-11-01T08:00:00.000Z"
    }
  ]
}
```
> `password`, `otp`, and `otpExpiry` are stripped from all responses.

---

### Get Single Customer
```
GET /api/admin/users/:id
```

**Response 200**
```json
{
  "success": true,
  "message": "Customer retrieved successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "email": "buyer@example.com",
    "phone": "+919876543210",
    "status": "active",
    "dateCreated": "2024-11-01T08:00:00.000Z"
  }
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 404 | User not found |

---

### Block a Customer
Prevents the user from making any authenticated API calls immediately.

```
PUT /api/admin/users/:id/block
```

No request body required.

**Response 200**
```json
{
  "success": true,
  "message": "User blocked successfully"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 400 | User is already blocked |
| 400 | Invalid user id |
| 404 | User not found |

---

### Unblock a Customer
Restores account to `active`.

```
PUT /api/admin/users/:id/unblock
```

No request body required.

**Response 200**
```json
{
  "success": true,
  "message": "User active successfully"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 400 | User is already active |
| 404 | User not found |

---

### Suspend a Customer
Temporarily restricts the user. Same enforcement as block — all authenticated calls return 403.

```
PUT /api/admin/users/:id/suspend
```

No request body required.

**Response 200**
```json
{
  "success": true,
  "message": "User suspended successfully"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 400 | User is already suspended |
| 404 | User not found |

---

### Account Status Enforcement

The `authMiddleware` checks every authenticated request:

| User status | HTTP response |
|-------------|---------------|
| `active` (or field absent) | Proceeds normally |
| `blocked` | `403 Your account has been blocked. Please contact support.` |
| `suspended` | `403 Your account has been temporarily suspended. Please contact support.` |

---

## Payout / Withdrawal Management

### List Withdrawal Requests
Returns all seller payout requests across the platform.

```
GET /api/admin/withdrawals
```

Query params:

| Param | Type | Values | Description |
|-------|------|--------|-------------|
| `status` | string | `Pending \| Approved \| Paid \| Rejected` | Filter by status (omit for all) |

**Response 200**
```json
{
  "success": true,
  "message": "Withdrawals retrieved successfully",
  "data": [
    {
      "_id": "665b2c3d4e5f6a7b8c9d0e1f",
      "SellerID": "664a1b2c3d4e5f6a7b8c9d0e",
      "BankAccountID": "665c3d4e5f6a7b8c9d0e1f20",
      "BankSnapshot": {
        "AccountHolderName": "Rajesh Kumar",
        "AccountNumber": "123456789012",
        "IFSC": "HDFC0001234",
        "BankName": "HDFC Bank"
      },
      "Amount": 4750.00,
      "EarningIDs": [
        "666d4e5f6a7b8c9d0e1f2031",
        "666d4e5f6a7b8c9d0e1f2032"
      ],
      "Status": "Pending",
      "Reference": null,
      "Notes": null,
      "RequestedAt": "2024-12-10T14:30:00.000Z",
      "ProcessedAt": null,
      "ProcessedBy": null
    }
  ]
}
```

**Field reference — Withdrawals**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Payout record ID |
| `SellerID` | ObjectId | Seller who requested the payout |
| `BankAccountID` | ObjectId | Linked `SellerBankAccounts._id` at request time |
| `BankSnapshot` | object | Snapshot of bank details captured at request time (immutable) |
| `BankSnapshot.AccountHolderName` | string | Account holder name |
| `BankSnapshot.AccountNumber` | string | Bank account number |
| `BankSnapshot.IFSC` | string | IFSC code |
| `BankSnapshot.BankName` | string | Bank name |
| `Amount` | decimal | Total payout amount (sum of covered earnings net of commission) |
| `EarningIDs` | ObjectId[] | `SellerEarnings._id` records locked into this payout |
| `Status` | string | `Pending \| Approved \| Paid \| Rejected` |
| `Reference` | string \| null | UTR / bank transaction ID — set when marking Paid |
| `Notes` | string \| null | Admin note (e.g. reason for rejection) |
| `RequestedAt` | timestamp | When the seller submitted the request |
| `ProcessedAt` | timestamp \| null | When the admin paid or rejected |
| `ProcessedBy` | ObjectId \| null | Admin user who processed it |

---

### Pay (Approve) a Withdrawal
Marks the withdrawal as `Paid` after the admin has transferred the money externally. Covered `SellerEarnings` move from `Requested` → `Settled`.

```
PUT /api/admin/withdrawals/:withdrawalID/pay
```

**Request body**
```json
{
  "Reference": "UTR123456789012",
  "Notes": "Transferred via NEFT"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `Reference` | Yes | UTR or bank transaction ID for audit trail |
| `Notes` | No | Optional admin note |

**Response 200**
```json
{
  "success": true,
  "message": "Withdrawal marked as paid"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 400 | `Reference` is missing |
| 400 | Withdrawal is already `Paid` or `Rejected` |
| 400 | Invalid withdrawal id |
| 404 | Withdrawal not found |

---

### Reject a Withdrawal
Rejects the payout request and releases the locked earnings back to `Available` so the seller can request again.

```
PUT /api/admin/withdrawals/:withdrawalID/reject
```

**Request body**
```json
{
  "Notes": "Bank details could not be verified"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `Notes` | Yes | Reason for rejection (visible in seller history) |

**Response 200**
```json
{
  "success": true,
  "message": "Withdrawal rejected"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| 400 | `Notes` is missing |
| 400 | Withdrawal is already `Paid` or `Rejected` |
| 400 | Invalid withdrawal id |
| 404 | Withdrawal not found |

---

## Payout Lifecycle

```
Seller earnings lifecycle:
  Pending  →  Available  →  Requested  →  Settled
                                ↓ (on Reject)
                             Available

Withdrawal status:
  Pending  →  Paid      (admin pays)
  Pending  →  Rejected  (admin rejects → earnings released)
  Approved →  Paid      (if manually set to Approved first)
  Approved →  Rejected
```

The `BankSnapshot` is captured at request time so the payout record stays accurate even if the seller later edits or deletes their bank account.

---

## Seller Earnings Reference (read-only context for admin)

When reviewing a withdrawal the admin sees `EarningIDs`. Each earning in `SellerEarnings` has:

| Field | Description |
|-------|-------------|
| `SellerID` | Seller this earning belongs to |
| `CheckoutID` | The paid order it came from |
| `ProductID` | The sold product |
| `GrossAmount` | Product price snapshotted at sale time |
| `CommissionRate` | Platform rate applied (e.g. `0.10` = 10%) |
| `CommissionAmount` | `GrossAmount × CommissionRate` |
| `NetAmount` | `GrossAmount − CommissionAmount` (what goes to the seller) |
| `Status` | `Pending \| Available \| Requested \| Settled` |
| `SaleDate` | When the sale occurred |
| `AvailableAt` | When it became withdrawable (delivery confirmed + hold window) |
| `WithdrawalID` | Which `Withdrawals._id` it is locked into (set when Requested) |

---

## Other Admin Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/roles` | List all roles |
| `POST` | `/api/roles` | Create a role |
| `POST` | `/api/roles/assign` | Assign a role to a user |
| `DELETE` | `/api/roles/remove` | Remove a role from a user |
