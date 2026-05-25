# Commission System — Frontend Integration Guide

**Version:** 1.0.0 | **Status:** Active | **Audience:** Frontend developers

> This document covers every frontend change required to support the two-sided commission model
> introduced in the backend. Read this alongside `FrontendIntegration.md` — the base API contract
> still applies; this doc only describes **what changed** and **what the frontend must do differently**.

---

## 1. How the Commission Model Works

Two independent commission rates are controlled by the backend via environment variables.
The frontend **never hard-codes rates** — it always reads the values from API responses.

| Commission | Direction | Effect |
|---|---|---|
| `BUYER_COMMISSION_RATE` (e.g. 2%) | Added on top of seller's listed `Price` | Buyer pays more; extra goes to platform |
| `PLATFORM_COMMISSION_RATE` (e.g. 2%) | Deducted from seller's effective sale price | Seller receives less; deducted portion goes to platform |

### Money example — ₹2499 product, both rates at 2%

```
Seller lists at          ₹2499   (Price — stored in DB, never shown to buyer directly)
Buyer commission (2%)  +   ₹50   (Math.round(2499 × 0.02))
──────────────────────────────
Buyer pays               ₹2549   (DisplayPrice — what the buyer sees and pays)

Seller's base            ₹2499
Seller commission (2%) −   ₹50   (Math.round(2499 × 0.02))
──────────────────────────────
Seller receives          ₹2449   (NetAmount — credited to seller wallet)

Platform earns             ₹100  (₹50 buyer side + ₹50 seller side)
```

### With an active offer — ₹2499 product, 10% offer, both rates at 2%

```
Seller lists at          ₹2499
Offer discount (10%)   −  ₹250
Effective price          ₹2249   (what the buyer actually pays for the product)

Buyer commission (2%)  +   ₹45   (Math.round(2249 × 0.02))
──────────────────────────────
Buyer pays               ₹2294   (DisplayPrice after offer + buyer commission)

Seller's effective       ₹2249
Seller commission (2%) −   ₹45
──────────────────────────────
Seller receives          ₹2204   (NetAmount)
```

> **Key rule:** buyer commission is applied to the *effective* price (after any offer discount),
> not the raw listed price. The backend returns the pre-computed `DisplayPrice` — the frontend
> does not need to recalculate it.

---

## 2. Changed API Responses

### 2.1 Product listing & detail

**Endpoints affected:**
- `GET /api/products`
- `GET /api/products/:productID`

**New field in every product object:**

```json
{
  "_id": "...",
  "ProductName": "Aquanaut Rose Gold 5261R-001",
  "Price": 249900,
  "DisplayPrice": 254898,
  "Offer": {
    "DiscountPercentage": 10,
    "OfferName": "Summer Sale",
    "IsActive": true,
    "StartDate": "...",
    "EndDate": "..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `Price` | `number` (paise) | Seller's original listed price. **Do not show to buyers.** |
| `DisplayPrice` | `number` (paise) | `Price + buyer commission`. Show this to buyers as the purchase price. |
| `Offer` | `object \| undefined` | Present only when a valid, active offer exists. |

**Frontend rules:**
- Always show `DisplayPrice` to buyers everywhere (listing cards, PDP, search results).
- Never show the raw `Price` to buyers.
- When an offer is active, the `DisplayPrice` already factors in the discounted price + buyer commission. Show the offer badge (e.g. "10% OFF") separately alongside `DisplayPrice`.
- `Price` is only needed on the **seller's own listings dashboard** to show what they listed the product for.

---

### 2.2 Cart

**Endpoint:** `GET /api/cart/user/:userID`

Each cart line now includes `DisplayPrice`:

```json
{
  "_id": "cart_line_id",
  "ProductID": "...",
  "Quantity": 1,
  "ProductName": "Aquanaut Rose Gold 5261R-001",
  "Price": 249900,
  "DisplayPrice": 254898,
  "Offer": { "DiscountPercentage": 10, ... }
}
```

**Frontend rules:**
- Show `DisplayPrice` per item, not `Price`.
- Compute the cart subtotal and order total using `DisplayPrice × Quantity`:
  ```js
  const total = cartItems.reduce((sum, item) => sum + item.DisplayPrice * item.Quantity, 0);
  ```
- Pass this `total` (in paise) as the `amount` when calling `POST /api/payments/create-order`.

---

### 2.3 Wishlist

**Endpoint:** `GET /api/wishlist/user/:userID`

Same `DisplayPrice` field added alongside `Price`.

**Frontend rule:** Show `DisplayPrice` on wishlist cards. Same logic as cart.

---

### 2.4 Seller wallet — itemised earnings

**Endpoint:** `GET /api/seller/wallet/items?status=<status>`

Each earning record now has an extended breakdown:

```json
{
  "ProductID": "...",
  "ProductName": "Aquanaut Rose Gold 5261R-001",
  "ImageURL": "https://...",
  "Status": "Available",
  "SaleDate": "2026-05-20T10:30:00.000Z",
  "AvailableAt": "2026-05-27T10:30:00.000Z",

  "OfferDiscountPercentage": 10,
  "OfferDiscountAmount": 25000,
  "GrossAmount": 224900,
  "CommissionRate": 0.02,
  "CommissionAmount": 4498,
  "NetAmount": 220402
}
```

| Field | Type | Description |
|---|---|---|
| `OfferDiscountPercentage` | `number` | Offer % that was active when the buyer paid. `0` if no offer. |
| `OfferDiscountAmount` | `number` (paise) | Amount deducted by the offer. `0` if no offer. |
| `GrossAmount` | `number` (paise) | Effective price buyer paid per unit (after offer, before platform commissions). |
| `CommissionRate` | `number` | Seller commission rate applied (e.g. `0.02`). |
| `CommissionAmount` | `number` (paise) | Platform's seller-side cut. |
| `NetAmount` | `number` (paise) | What the seller actually receives. `GrossAmount − CommissionAmount`. |

**Frontend rules for the seller earnings breakdown UI:**

Render a per-sale breakdown row like this:

```
Listed price:           ₹2,499.00
Offer discount (10%):  − ₹250.00
─────────────────────────────────
Effective price:         ₹2,249.00
Platform fee (2%):      −  ₹44.98
─────────────────────────────────
You receive:             ₹2,204.02
```

Helper to convert paise to rupees for display:
```js
const toRupees = (paise) => (paise / 100).toFixed(2);
```

Show `OfferDiscountAmount` row only when `OfferDiscountPercentage > 0`.

---

### 2.5 Seller wallet summary

**Endpoint:** `GET /api/seller/wallet`

No new fields. `availableBalance`, `pendingBalance`, `inProcessBalance`, `totalWithdrawn`, and
`totalEarned` are all already in `NetAmount` terms (seller's net, after seller commission,
after offer discount). No change needed in how these totals are displayed.

---

## 3. Payment Flow Changes

### 3.1 What amount to send

The `amount` field in `POST /api/payments/create-order` must now equal the buyer's total using
`DisplayPrice`, not the raw `Price`.

**Before (wrong after this change):**
```js
const amount = cartItems.reduce((sum, item) => sum + item.Price * item.Quantity, 0);
```

**After (correct):**
```js
const amount = cartItems.reduce((sum, item) => sum + item.DisplayPrice * item.Quantity, 0);
```

This is already the paise value — pass it directly. No extra multiplication needed.

### 3.2 Full create-order request

```json
{
  "UserID": "6789295b...",
  "amount": 254898,
  "currency": "INR",
  "address": { ... },
  "checkout": {
    "ProductIDs": ["678a50c7..."],
    "TotalAmount": 254898,
    "DeliveryStatus": "Pending",
    "CheckoutDate": "2026-05-25T10:30:00.000Z"
  }
}
```

`TotalAmount` in the checkout draft should also use `DisplayPrice`-based total.

---

## 4. Displaying Prices — UI Checklist

### Buyer-facing surfaces

| Surface | Field to show | Notes |
|---|---|---|
| Product listing card | `DisplayPrice` | Show formatted in ₹ |
| Product detail page | `DisplayPrice` | Show as the purchase price |
| Offer badge | `Offer.DiscountPercentage` | Show "X% OFF" badge when `Offer` exists |
| Cart line item | `DisplayPrice` | Per-unit price |
| Cart subtotal | `Σ DisplayPrice × Quantity` | Compute client-side |
| Order summary / checkout | `Σ DisplayPrice × Quantity` | This is what Razorpay charges |
| Wishlist card | `DisplayPrice` | |
| Order history (past orders) | `TotalAmount` from checkout | Already stored correctly at purchase time |

### Seller-facing surfaces

| Surface | Field to show | Notes |
|---|---|---|
| My listings dashboard | `Price` | The price the seller set |
| Earnings list — sale price | `GrossAmount` | Effective price after offer (paise → ₹) |
| Earnings list — offer row | `OfferDiscountAmount` | Only show when `OfferDiscountPercentage > 0` |
| Earnings list — platform fee | `CommissionAmount` | Show as deduction |
| Earnings list — you receive | `NetAmount` | Highlighted total |
| Wallet summary balances | `availableBalance` / `pendingBalance` / etc. | Already net amounts |

---

## 5. Formatting Helper

All monetary amounts from the API are in **paise** (1 INR = 100 paise). Use this helper everywhere:

```js
/**
 * Converts paise to a formatted INR string.
 * formatINR(249900) → "₹2,499.00"
 */
function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}
```

---

## 6. What Does NOT Change

- The `Price` field on products is still returned — it is the seller's raw listed price.
  It should only appear in seller-facing UIs (e.g. "you listed this at ₹2,499").
- The `Offer.DiscountPercentage` logic for showing discount badges is unchanged.
- The Razorpay checkout flow (`create-order` → SDK → `verify`) is structurally unchanged;
  only the `amount` value sent to `create-order` changes (use `DisplayPrice`-based total).
- Seller listing creation (`POST /api/products`) still sends `Price` as the seller's intended
  base price. No change to the create/edit product form.
- The seller wallet summary endpoint and withdrawal flow are unchanged.

---

## 7. Summary of Changes by Page

| Page / Component | Change Required |
|---|---|
| Product listing page | Show `DisplayPrice` instead of `Price` |
| Product detail page | Show `DisplayPrice` instead of `Price` |
| Cart page | Show `DisplayPrice` per item; use it for subtotal/total |
| Wishlist page | Show `DisplayPrice` instead of `Price` |
| Checkout / order summary | Use `DisplayPrice`-based total for `amount` in payment |
| Payment (`create-order` call) | Send `Σ DisplayPrice × Qty` as `amount` |
| Seller — my listings | No change (keep showing `Price`) |
| Seller — earnings list | Show `GrossAmount`, `OfferDiscountAmount`, `CommissionAmount`, `NetAmount` breakdown |
| Seller — wallet summary | No change |
