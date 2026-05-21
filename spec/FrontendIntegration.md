# Harmoniv Time — Frontend Integration Guide (Buyer & Seller Flows)

**Version:** 1.0.0 | **Status:** Active | **Audience:** Frontend developers

> This document is the end-to-end integration reference for the two user journeys the
> Harmoniv Time backend supports: the **Seller** (list a watch, upload images, manage
> listings, fulfil orders) and the **Buyer** (browse, cart, address, checkout, pay, track
> orders). Every endpoint below shows its **method + path**, **headers**, **request
> payload**, **success response**, **error responses**, and a **FE note** describing what to
> store and what to render.
>
> All paths are relative to the API base. Endpoint/method/shape claims here are taken from
> the route, validation (`*.validation.ts`), controller, and repository files under
> `src/modules/**`.

---

## 1. Conventions

### Base URL & headers

```
Base URL:  http://<host>:<port>/api
Content-Type: application/json          (except image upload → multipart/form-data)
Authorization: Bearer <JWT>             (send on every authenticated call — see §2)
```

All gateways (auth / public / customer / seller / admin) mount under `/api`
(`src/routes/index.ts`), so every path in this doc is `/api/...`.

### Response envelope

Every endpoint returns the same envelope (`src/shared/utils/apiResponse.ts`):

```json
{ "message": "string", "data": <object | array | null> }
```

- On success, `data` holds the payload (or `null` for action-only responses).
- On error, the same shape is returned with an error `message` and usually `data: null`.

### HTTP status codes

| Code | Meaning | Typical cause |
|------|---------|---------------|
| 200 | OK | Successful read / update / delete |
| 201 | Created | Resource created (register, product, cart add, checkout, order…) |
| 400 | Bad Request | Validation failed, invalid ObjectId, payment signature mismatch |
| 401 | Unauthorized | Missing/invalid token, bad login credentials |
| 404 | Not Found | Resource id does not exist |
| 409 | Conflict | Duplicate (email already exists, product already in cart) |
| 500 | Server Error | Unhandled / upstream (email, ImgBB, Razorpay) failure |

### IDs, dates & money

- All `*ID` fields are **MongoDB ObjectId strings** (e.g. `"678a50c71a4995d56f3ca8ac"`).
- Dates are ISO 8601 strings (`"2026-05-20T10:30:00.000Z"`).
- Payment `amount` is in the **smallest currency unit** (paise for INR) — multiply rupees by 100.

---

## 2. Authentication & User (shared by both roles)

JWT details (`src/shared/services/token.service.ts`, `auth.middleware.ts`):
- Token payload = `{ userId, email }`. Register issues a token valid `1h`; login issues one with the default expiry.
- Send it as `Authorization: Bearer <token>`.
- **Note:** currently only `GET /api/users/profile` enforces the token at the route level; other
  routes do not yet check it. **Send the token everywhere anyway** so the app keeps working when
  auth is enforced. The frontend decides Seller vs Buyer UI from the user's roles (see profile).

Roles (`src/shared/constants/roles.ts`): `ADMIN = 1`, `SELLER = 2`, `CUSTOMER = 3`.
New registrations get **CUSTOMER (3)** by default; role lives in the `UserRoles` collection, not on the user document.

### 2.1 Register — `POST /api/auth/register`

Request:
```json
{
  "email": "jane@example.com",   // required, valid email
  "password": "secret123",        // required, min 8 chars
  "phone": "9876543210"           // optional
}
```
Success `201`:
```json
{
  "message": "User created successfully",
  "data": { "userId": "6789295bd56a7dc9479a6e6d", "token": "eyJhbGciOiJIUzI1NiIs..." }
}
```
Errors: `409 "Email already exists"`, `400` validation.
**FE note:** store `userId` and `token`; user starts as CUSTOMER.

### 2.2 Login — `POST /api/auth/login`

Request:
```json
{ "email": "jane@example.com", "password": "secret123" }
```
Success `200`:
```json
{ "message": "Login successful", "data": { "token": "eyJhbGciOiJIUzI1NiIs..." } }
```
Errors: `401 "Invalid email or password"`.
**FE note:** store the token; attach `Authorization: Bearer <token>` to subsequent calls.
The `userId` is inside the JWT payload — decode it client-side or call `GET /api/users/profile`.

### 2.3 Verify email — `POST /api/auth/verify-email`
Request: `{ "email": "jane@example.com" }` → Success `200 "OTP sent to email"`. Error `404 "Email not found"`.

### 2.4 Verify phone — `POST /api/auth/verify-phone`
Request: `{ "phone": "9876543210", "countryCode": "+91" }` → Success `200 "OTP sent to phone"`. Error `404 "Phone number not found"`.

### 2.5 Reset password — `POST /api/auth/reset-password`
Request (supply **either** `email` or `phone`):
```json
{ "email": "jane@example.com", "otp": "123456", "newPassword": "newsecret123" }
```
Success `200 "Password reset successfully"`. Errors: `400 "Invalid or expired OTP"`, `404 "User not found"`.

### 2.6 Get my profile — `GET /api/users/profile`  *(Bearer required)*
Headers: `Authorization: Bearer <token>`. No body.
Success `200`:
```json
{
  "message": "User profile retrieved successfully",
  "data": {
    "_id": "6789295bd56a7dc9479a6e6d",
    "email": "jane@example.com",
    "phone": "9876543210",
    "dateCreated": "2026-05-01T08:00:00.000Z",
    "roles": [3]
  }
}
```
**FE note:** branch UI on `roles` (`2` = seller surface, `3` = buyer surface). Password is stripped.

### 2.7 Other user endpoints
- `GET /api/users` → list all users.
- `GET /api/users/:id` → single user.
- `PUT /api/users/:id` → body `{ "email"?, "phone"? }` (min 1 field) → `200 "User updated successfully"`.
- `DELETE /api/users/:id` → `200 "User deleted successfully"`.

---

## 3. SELLER FLOW

Goal: get a watch listed with full specs + images, then manage and fulfil it.
The seller's own user id (`UserID`) ties every listing to them.

### Step 1 — Load reference data for the listing form

These power the dropdowns on the "create product" form. All are `GET`, no auth, return arrays
under `data`. Create endpoints exist too (admin-managed) but the seller form normally just reads.

| Dropdown | Endpoint | Item shape |
|----------|----------|------------|
| Brands | `GET /api/brands` | `{ _id, BrandName }` |
| Collections | `GET /api/collections` | `{ _id, BrandID, CollectionName }` |
| Categories | `GET /api/categories` | `{ _id, CategoryName }` |
| Recipients | `GET /api/recipients` | `{ _id, RecipientName }` |
| Dial colors | `GET /api/dial-colors` | `{ _id, DialColorName }` |
| Movements | `GET /api/movements` | `{ _id, MovementName }` |
| Strap materials | `GET /api/strap-materials` | `{ _id, StrapMaterialName }` |
| Case materials | `GET /api/case-materials` | `{ _id, CaseMaterialName }` |
| Watch markers | `GET /api/watch-markers` | `{ _id, WatchMarkerName }` |
| Delivery options | `GET /api/delivery-options` | `{ _id, DeliveryOptionName }` |

Example — `GET /api/brands`:
```json
{ "message": "...", "data": [ { "_id": "677d2d34afebf88d6ed8f2b5", "BrandName": "Patek Philippe" } ] }
```
**FE note:** filter the collections list by the chosen brand's `_id` (`BrandID`) when the user picks a brand.

### Step 2 — Create the product — `POST /api/products`

Request (all `*ID` are ObjectId strings from Step 1):
```json
{
  "UserID": "6789295bd56a7dc9479a6e6d",     // the seller
  "ProductName": "Aquanaut Rose Gold 5261R-001",
  "BrandID": "677d2d34afebf88d6ed8f2b5",
  "CollectionID": "677d36099c802cde5f238bbe",
  "CategoryID": "677d36a79c802cde5f238c3a",
  "RecipientID": "677d36fb9c802cde5f238c49",
  "Price": 1200000                            // required, number
}
```
Success `201`:
```json
{ "message": "Product created successfully", "data": { "acknowledged": true, "insertedId": "678a50c71a4995d56f3ca8ac" } }
```
The backend sets `IsAvailable: true` and `DateListed` automatically.
**FE note:** save `data.insertedId` as the `ProductID` — every following step needs it.

### Step 3 — Add specs, description and delivery/returns

Run after Step 2 with the new `ProductID`. All three are independent `POST`s.

**3a. Specs — `POST /api/product-details`**
```json
{
  "ProductID": "678a50c71a4995d56f3ca8ac",   // required
  "DialColorID": "677d37379c802cde5f238c53", // all spec IDs optional ("" / null allowed)
  "MovementID": "677d380c9c802cde5f238c5d",
  "StrapMaterialID": "677d38449c802cde5f238c6b",
  "CaseMaterialID": "677d38809c802cde5f238c75",
  "WatchMarkersID": "677d38c09c802cde5f238c84",
  "DeliveryOptionID": "677d3a007b943a9d86695740",
  "Diameter": "40mm",
  "WaterResistant": "Yes",
  "ManufacturerProductNumber": "5261R-001",
  "Guarantee": "2 years"
}
```
Success `201` → `"Product details created successfully"`.

**3b. Description — `POST /api/product-descriptions`**
```json
{
  "ProductID": "678a50c71a4995d56f3ca8ac",   // required
  "Title": "Patek Philippe Aquanaut",         // optional
  "Content": "Full marketing description...",  // optional
  "AdditionalDetails": "Includes box & papers" // optional
}
```

**3c. Delivery & returns — `POST /api/delivery-returns`**
```json
{
  "ProductID": "678a50c71a4995d56f3ca8ac",     // required
  "DeliveryInformation": "Ships in 2 business days", // optional
  "ReturnsPolicy": "14-day returns"                  // optional
}
```
**FE note:** the catalog read in Step 6 nests all three back under the product, so submit them
right after creating the product.

### Step 4 — Upload images — `POST /api/upload/images`

This uploads files to ImgBB and returns hosted URLs. **Multipart**, not JSON.

Headers: `Content-Type: multipart/form-data` (the browser sets this automatically with `FormData`).
Form fields:
- `images` — the file input, **up to 10 files** (field name must be `images`).
- `userID` — the seller id (string).
- `productID` — the product id from Step 2 (string).

Success `200`:
```json
{ "message": "Images uploaded successfully", "data": { "urls": [
  "https://i.ibb.co/aaa/img1.jpg",
  "https://i.ibb.co/bbb/img2.jpg"
] } }
```
Error: `400 "No files uploaded"`.
**FE note:** this step only hosts the files. It does **not** attach them to the product —
do that in Step 5 with the returned `urls`.

Example (browser):
```js
const fd = new FormData();
files.forEach(f => fd.append("images", f));
fd.append("userID", sellerId);
fd.append("productID", productId);
await fetch("/api/upload/images", { method: "POST", body: fd });
```

### Step 5 — Attach images to the product — `POST /api/product-images`

Request (use the URLs from Step 4):
```json
{
  "ProductID": "678a50c71a4995d56f3ca8ac",  // required
  "ImageURLs": [                              // required, min 1
    { "url": "https://i.ibb.co/aaa/img1.jpg", "key": "" },
    { "url": "https://i.ibb.co/bbb/img2.jpg" }
  ],
  "AltText": "Patek Philippe Aquanaut"        // optional, applied to all
}
```
Success `201 "Product images created successfully"`. Error: `400 "Invalid ProductID"`.
**FE note:** the **first** URL in the array is automatically marked `IsPrimary: true` — order
the array so the hero image comes first.

Manage individual images:
- `GET /api/product-images/product/:productID` → all images for a product.
- `GET /api/product-images/:imageID` → one image.
- `PUT /api/product-images/:imageID` → body any of `{ ImageURL?, key?, IsPrimary?, AltText? }` (min 1).
- `DELETE /api/product-images/:imageID`.

### Step 6 — View my listings — `GET /api/products?UserID={sellerId}`

Query params: `UserID` (filter to this seller), `IsAvailable` (omit → only available; pass any
value to include unavailable too).
Success `200` — each product is **fully enriched** (product + description + details with resolved
lookup names + images + delivery/returns):
```json
{
  "message": "Products retrieved successfully.",
  "data": [
    {
      "_id": "678a50c71a4995d56f3ca8ac",
      "UserID": "6789295bd56a7dc9479a6e6d",
      "ProductName": "Aquanaut Rose Gold 5261R-001",
      "Price": 1200000,
      "IsAvailable": true,
      "DateListed": "2026-05-01T12:44:55.556Z",
      "Description": { "_id": "...", "Title": "...", "Content": "...", "AdditionalDetails": "...", "CreatedAt": "..." },
      "Details": {
        "_id": "...", "Diameter": "40mm", "WaterResistant": "Yes",
        "ManufacturerProductNumber": "5261R-001", "Guarantee": "2 years",
        "BrandName": "Patek Philippe", "BrandId": "...",
        "CollectionName": "Aquanaut", "CollectionId": "...",
        "CategoryName": "Watches", "CategoryId": "...",
        "RecipientName": "For Him", "RecipientId": "...",
        "DialColorName": "Blue", "DialColorId": "...",
        "MovementName": "Automatic", "MovementId": "...",
        "StrapMaterialName": "Rubber", "StrapMaterialId": "...",
        "CaseMaterialName": "Gold", "CaseMaterialId": "...",
        "WatchMarkerName": "Arabic Numerals", "WatchMarkerId": "...",
        "DeliveryOptionName": "Standard", "DeliveryOptionID": "..."
      },
      "Images": [ { "_id": "...", "ProductID": "...", "ImageURL": "https://i.ibb.co/aaa/img1.jpg", "key": "", "IsPrimary": true, "AltText": "..." } ],
      "DeliveryAndReturns": { "_id": "...", "ProductID": "...", "DeliveryInformation": "...", "ReturnsPolicy": "...", "CreatedAt": "..." }
    }
  ]
}
```
**FE note:** render the dashboard straight from this single response — the primary image is the
one with `IsPrimary: true`; the `Details.*Name` fields are display-ready (no extra lookups needed).

### Step 7 — Edit / unlist / delete

- **Update specs/description/delivery:** `PUT /api/product-details/:productID`,
  `PUT /api/product-descriptions/:productID`, `PUT /api/delivery-returns/product/:productID`
  (send only changed fields, min 1).
- **Unlist (soft delete) — `PUT /api/products/availability`:**
  ```json
  { "ProductIDs": ["678a50c71a4995d56f3ca8ac"] }   // required, min 1
  ```
  Success `200`: `{ "message": "1 products updated successfully", "data": { "matchedCount": 1, "modifiedCount": 1 } }`.
  Error: `404 "No products found with the given IDs"`. Sets `IsAvailable: false` (hidden from buyers).
- **Hard delete — `DELETE /api/products/:productID`** → `200 "Product deleted successfully"`, `404` if missing.

### Step 8 — Fulfilment (shipments)

After a buyer pays, the seller creates a shipment and updates its status as it moves.

**Create — `POST /api/shipments`**
```json
{
  "CheckoutID": "678b0011...",   // required — the buyer's order
  "SellerID": "6789295b...",     // required
  "Courier": "BlueDart",          // required
  "TrackingNumber": "BD123456789",// required
  "TrackingURL": "https://bluedart.com/track/BD123456789", // optional
  "ShipmentStatus": "Shipped",    // optional: Pending | Shipped | InTransit | OutForDelivery | Delivered
  "ShippedAt": "2026-05-20T10:00:00.000Z",       // optional
  "EstimatedDelivery": "2026-05-25T10:00:00.000Z",// optional
  "Notes": "Signature required"   // optional
}
```
Success `201`.
- **List my shipments — `GET /api/shipments/seller/:sellerID`**.
- **By order — `GET /api/shipments/checkout/:checkoutID`**.
- **Update status — `PUT /api/shipments/:shipmentID`** → any of the fields above plus
  `DeliveredAt` (min 1).
- **Delete — `DELETE /api/shipments/:shipmentID`**.
**FE note:** drive the shipment-status stepper UI from `ShipmentStatus`.

### Step 9 — Record/view sales

A sale row links buyer, seller and product for a completed transaction. See §5 (Sales) — shape is
shared with the buyer's purchase history. **Known limitation:** `GET /api/sales/user/:userID`
currently looks up by **buyer**, so a seller cannot yet list sales by their own id through that route.

---

## 4. BUYER FLOW

Goal: browse → product detail → cart → address → checkout → pay → track. `UserID` is the buyer's id.

### Step 1 — Browse the catalog — `GET /api/products`

Query params (both optional): `IsAvailable` (omit → only available products), `UserID` (filter to one seller).
Success `200` → array of the **same enriched product shape** shown in Seller Step 6.
**FE note:** render listing cards from `ProductName`, `Price`, and the `IsPrimary` image; use
`Details.BrandName` / `CollectionName` for labels and as client-side filter facets.

### Step 2 — Product detail — `GET /api/products/:productID`

No body. Success `200` → `{ "message": "ProductDetails Data !", "data": [ { ...enriched product... } ] }`
(`data` is an array with the single matched product). Error `404 "Product not found"`.
Images alone: `GET /api/product-images/product/:productID`.
**FE note:** build the PDP (gallery, specs table, description, delivery/returns) entirely from this payload.

### Step 3 — Recently viewed & wishlist (optional engagement)

- **Record a view — `POST /api/recently-viewed`**
  ```json
  { "UserID": "6789295b...", "ProductID": "678a50c7...", "ViewedAt": "2026-05-20T10:00:00.000Z" }
  ```
  (`ViewedAt` optional). Read: `GET /api/recently-viewed/user/:userID`. Delete: `DELETE /api/recently-viewed/:viewID`.
- **Add to wishlist — `POST /api/wishlist`**
  ```json
  { "UserID": "6789295b...", "ProductID": "678a50c7..." }
  ```
  Read: `GET /api/wishlist/user/:userID`. Remove: `DELETE /api/wishlist/:wishlistID`.

### Step 4 — Manage shipping address — `POST /api/address`

```json
{
  "UserID": "6789295b...",        // required
  "Country": "India",             // required
  "FirstName": "Jane",            // required
  "LastName": "Doe",              // required
  "AddressLine1": "12 MG Road",   // required
  "AddressLine2": "Apt 4B",       // optional
  "City": "Bengaluru",            // required
  "State": "Karnataka",           // required
  "PostalCode": "560001",         // required
  "Phone": "9876543210",          // required
  "orderNotes": "Leave at door",  // optional
  "IsDefault": true                // optional
}
```
Success `201` → created address (echoed in `data`).
- List: `GET /api/address/user/:userID`. One: `GET /api/address/:addressID`.
- Update: `PUT /api/address/:addressID` (any field, min 1). Delete: `DELETE /api/address/:addressID`.
**FE note:** keep the chosen `AddressID` for checkout (Step 6).

### Step 5 — Cart

**Add — `POST /api/cart`**
```json
{ "UserID": "6789295b...", "ProductID": "678a50c7...", "Quantity": 1 }
```
(`Quantity` optional, min 1, default 1.) Success `201`. Error `409` if the product is already in the cart.

**View (enriched) — `GET /api/cart/user/:userID`**
```json
{
  "message": "Cart retrieved successfully",
  "data": [
    {
      "_id": "cart_line_id", "UserID": "...", "ProductID": "...", "Quantity": 1,
      "ProductName": "Aquanaut Rose Gold 5261R-001", "Price": 1200000, "IsAvailable": true, "DateListed": "...",
      "Description": { "Title": "...", "Content": "...", "AdditionalDetails": "...", "CreatedAt": "..." },
      "Details": { "Diameter": "40mm", "WaterResistant": "Yes", "ManufacturerProductNumber": "5261R-001", "Guarantee": "2 years" },
      "Images": [ { "ImageURL": "https://i.ibb.co/aaa/img1.jpg", "IsPrimary": true, "AltText": "..." } ],
      "DeliveryAndReturns": { "DeliveryInformation": "...", "ReturnsPolicy": "..." }
    }
  ]
}
```
Only **available** products are returned. Compute the order total as `Σ (Price × Quantity)`.

**Update qty — `PUT /api/cart/:cartID`** → `{ "Quantity": 2 }` (required, min 1) → `200`.
**Remove — `DELETE /api/cart/:cartID`** → `200 "Product removed from cart successfully"`.
**FE note:** `:cartID` is the cart line `_id` from the view response, **not** the product id.

### Step 6 — Create the order (checkout)

**Create — `POST /api/checkout`** (the order header)
```json
{
  "UserID": "6789295b...",              // required
  "AddressID": "678af00...",            // required — from Step 4
  "TotalAmount": 1200000,                // required — your computed total
  "PaymentStatus": "Pending",            // required — start as "Pending"
  "DeliveryStatus": "Processing",        // required
  "CheckoutDate": "2026-05-20T10:30:00.000Z", // required (ISO)
  "ProductIDs": ["678a50c7..."]          // required, min 1
}
```
Success `201` → created checkout in `data`.
**FE note:** save `data._id` as `CheckoutID` for payment.

**Add line groups (optional) — `POST /api/checkout-items`**
```json
{ "CheckoutID": "678b0011...", "ProductIDs": ["678a50c7..."], "Price": 1200000, "Quantity": 1 }
```
(`Quantity` optional.) Read: `GET /api/checkout-items/checkout/:checkoutID`.
Update qty: `PUT /api/checkout-items/:checkoutItemID` → `{ "Quantity": 2 }`. Remove: `DELETE /api/checkout-items/:checkoutItemID`.

### Step 7 — Payment (Razorpay)

Sequence: **create-order → open Razorpay → verify**.

**7a. Create payment order — `POST /api/payments/create-order`**
```json
{
  "CheckoutID": "678b0011...",  // required
  "UserID": "6789295b...",       // required
  "amount": 1200000,             // required — smallest unit (paise). ₹12,000 → 1200000
  "currency": "INR"              // optional, default "INR"
}
```
Success `201` → the **Razorpay order object**:
```json
{
  "message": "Order created successfully",
  "data": {
    "id": "order_NXxxxxxxxxx", "entity": "order", "amount": 1200000, "amount_due": 1200000,
    "amount_paid": 0, "currency": "INR", "receipt": "rcpt_1716200000000", "status": "created",
    "attempts": 0, "created_at": 1716200000
  }
}
```
Error: `400 "Invalid CheckoutID"`. A Payment row is persisted server-side with `PaymentStatus: "Created"`.

**7b. Open Razorpay Checkout (client SDK)** with `data.id` (the order id) and your Razorpay public
`key_id`. On success the SDK returns `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.

```js
const rzp = new Razorpay({
  key: RAZORPAY_KEY_ID,            // public key (frontend env)
  order_id: order.id,              // from 7a
  amount: order.amount,
  currency: order.currency,
  handler: (resp) => verify(resp), // resp has the 3 razorpay_* fields
});
rzp.open();
```

**7c. Verify — `POST /api/payments/verify`**
```json
{
  "razorpay_order_id": "order_NXxxxxxxxxx",   // required
  "razorpay_payment_id": "pay_NXyyyyyyyyy",   // required
  "razorpay_signature": "9ef4dffbfd84f1318...",// required
  "PaymentMethod": "card"                      // optional (card | upi | netbanking)
}
```
Success `200 "Payment verified successfully"`. The backend recomputes the HMAC-SHA256 signature; on
match it sets the Payment to `Verified` (+ `PaidAt`) and the Checkout's `PaymentStatus` to `Paid`.
Error: `400 "Payment verification failed"` (signature mismatch → Payment marked `Failed`).
**FE note:** only treat the order as paid after a `200` here — never trust the client SDK callback alone.

**7d. Confirm**
- `GET /api/checkout/:checkoutID` → check `PaymentStatus === "Paid"`.
- `GET /api/payments/checkout/:checkoutID` → payment records for the order:
```json
{ "message": "Payments retrieved successfully", "data": [ {
  "_id": "...", "CheckoutID": "...", "UserID": "...", "Amount": 1200000, "Currency": "INR",
  "RazorpayOrderID": "order_NX...", "RazorpayPaymentID": "pay_NX...", "PaymentMethod": "card",
  "PaymentStatus": "Verified", "Receipt": "rcpt_...", "PaidAt": "...", "CreatedAt": "..."
} ] }
```

### Step 8 — Order & purchase history

**Orders (enriched) — `GET /api/checkout/user/:userID`**
```json
{
  "message": "Checkouts retrieved successfully",
  "data": [
    {
      "_id": "678b0011...", "TotalAmount": 1200000, "PaymentStatus": "Paid",
      "CheckoutDate": "2026-05-20T10:30:00.000Z", "DeliveryStatus": "Processing",
      "Products": [ { "ProductName": "Aquanaut Rose Gold 5261R-001", "Price": 1200000, "ImageURL": "https://i.ibb.co/aaa/img1.jpg" } ]
    }
  ]
}
```
Single order: `GET /api/checkout/:checkoutID`. Update status (admin/seller): `PUT /api/checkout/:checkoutID/status` → `{ "PaymentStatus"?, "DeliveryStatus"? }` (min 1).
**FE note:** render the orders list directly from this — each product already has name, price and a primary image URL.

**Purchase history (sales) — `GET /api/sales/user/:userID`** → see §5.

---

## 5. Sales (purchase / transaction records)

A `Sale` records one completed product transaction.

**Create — `POST /api/sales`**
```json
{
  "BuyerID": "6789295b...",   // required
  "SellerID": "6789aaa...",   // required
  "ProductID": "678a50c7...", // required
  "OfferID": null,             // optional (null / "" allowed)
  "SaleDate": "2026-05-20T10:30:00.000Z", // required
  "SalePrice": 1200000,        // required
  "DiscountAmount": 0,         // optional, default 0
  "FinalPrice": 1200000        // required
}
```
Success `201`.
- `GET /api/sales/:saleID` → one sale.
- `GET /api/sales/user/:userID` → sales where the user is the **buyer** (purchase history).
- `DELETE /api/sales/:saleID`.

---

## 6. End-to-end sequence (quick reference)

**Seller**
```
register/login ─► load reference data ─► POST /products ─► POST /product-details
   ─► POST /product-descriptions ─► POST /delivery-returns ─► POST /upload/images
   ─► POST /product-images ─► GET /products?UserID=me  (dashboard)
   ─► (order paid) POST /shipments ─► PUT /shipments/:id  (track to Delivered)
```

**Buyer**
```
register/login ─► GET /products ─► GET /products/:id ─► POST /cart
   ─► POST /address ─► POST /checkout ─► POST /payments/create-order
   ─► [Razorpay Checkout] ─► POST /payments/verify ─► GET /checkout/:id (Paid?)
   ─► GET /checkout/user/:userId  (order history)
```

---

## 7. Endpoint index

Auth/role column: **Bearer** = token enforced today; **open** = no route-level check yet (still send the token).

| Resource | Method & path | Purpose | Auth |
|----------|---------------|---------|------|
| Auth | POST `/auth/register` | Create account (CUSTOMER) | open |
| Auth | POST `/auth/login` | Get JWT | open |
| Auth | POST `/auth/verify-email` · `/auth/verify-phone` · `/auth/reset-password` | OTP / reset | open |
| Users | GET `/users/profile` | My profile + roles | **Bearer** |
| Users | GET `/users` · GET/PUT/DELETE `/users/:id` | User CRUD | open |
| Address | POST `/address` · GET `/address/user/:userID` · GET/PUT/DELETE `/address/:addressID` | Shipping addresses | open |
| Products | POST `/products` | Create listing (seller) | open |
| Products | GET `/products` · GET `/products/:productID` | Browse / detail (enriched) | open |
| Products | PUT `/products/availability` · DELETE `/products/:productID` | Unlist / delete | open |
| Product details | POST `/product-details` · GET/PUT/DELETE `/product-details/:productID` | Specs | open |
| Product descriptions | POST `/product-descriptions` · GET `/product-descriptions/:productID` · PUT/DELETE | Description | open |
| Product images | POST `/product-images` · GET `/product-images/product/:productID` · GET/PUT/DELETE `/product-images/:imageID` | Image records | open |
| Delivery/returns | POST `/delivery-returns` · GET `/delivery-returns/product/:productID` · … | Policy | open |
| Upload | POST `/upload/images` (multipart) · DELETE `/upload/images/:imageId` | Host files (ImgBB) | open |
| Reference | GET `/brands` `/collections` `/categories` `/recipients` `/dial-colors` `/movements` `/strap-materials` `/case-materials` `/watch-markers` `/delivery-options` `/offers` | Form dropdowns | open |
| Cart | POST `/cart` · GET `/cart/user/:userID` · PUT/DELETE `/cart/:cartID` | Cart (enriched read) | open |
| Wishlist | POST `/wishlist` · GET `/wishlist/user/:userID` · DELETE `/wishlist/:wishlistID` | Wishlist | open |
| Recently viewed | POST `/recently-viewed` · GET `/recently-viewed/user/:userID` · DELETE `/recently-viewed/:viewID` | Recently viewed | open |
| Checkout | POST `/checkout` · GET `/checkout/user/:userID` (enriched) · GET `/checkout/:checkoutID` · PUT `/checkout/:checkoutID/status` · DELETE | Orders | open |
| Checkout items | POST `/checkout-items` · GET `/checkout-items/checkout/:checkoutID` · PUT/DELETE `/checkout-items/:checkoutItemID` | Line groups | open |
| Payments | POST `/payments/create-order` · POST `/payments/verify` · GET `/payments/checkout/:checkoutID` | Razorpay | open |
| Shipments | POST `/shipments` · GET `/shipments/seller/:sellerID` · GET `/shipments/checkout/:checkoutID` · PUT/DELETE `/shipments/:shipmentID` | Fulfilment | open |
| Sales | POST `/sales` · GET `/sales/user/:userID` · GET `/sales/:saleID` · DELETE | Transactions | open |

---

## 8. Data-model field reference (what FE renders)

Enriched **Product** (catalog read): `_id, UserID, ProductName, Price, IsAvailable, DateListed,
Description{ Title, Content, AdditionalDetails, CreatedAt }, Details{ Diameter, WaterResistant,
ManufacturerProductNumber, Guarantee, BrandName/BrandId, CollectionName/CollectionId,
CategoryName/CategoryId, RecipientName/RecipientId, DialColorName/DialColorId,
MovementName/MovementId, StrapMaterialName/StrapMaterialId, CaseMaterialName/CaseMaterialId,
WatchMarkerName/WatchMarkerId, DeliveryOptionName/DeliveryOptionID }, Images[], DeliveryAndReturns`.

**Cart line (enriched):** `_id, UserID, ProductID, Quantity, ProductName, Price, IsAvailable,
DateListed, Description{…}, Details{ Diameter, WaterResistant, ManufacturerProductNumber,
Guarantee }, Images[], DeliveryAndReturns`.

**Checkout (raw):** `_id, UserID, AddressID, TotalAmount, PaymentStatus, DeliveryStatus,
CheckoutDate, ProductIDs[]`.
**Checkout (enriched by user):** `_id, TotalAmount, PaymentStatus, DeliveryStatus, CheckoutDate,
Products[]{ ProductName, Price, ImageURL }`.

**Payment:** `_id, CheckoutID, UserID, Amount, Currency, RazorpayOrderID, RazorpayPaymentID,
RazorpaySignature, PaymentMethod, PaymentStatus("Created"|"Verified"|"Failed"), Receipt, PaidAt, CreatedAt`.

**Address:** `_id, UserID, FirstName, LastName, Country, AddressLine1, AddressLine2, City, State,
PostalCode, Phone, orderNotes, IsDefault`.

**Shipment:** `_id, CheckoutID, SellerID, Courier, TrackingNumber, TrackingURL,
ShipmentStatus("Pending"|"Shipped"|"InTransit"|"OutForDelivery"|"Delivered"), ShippedAt,
EstimatedDelivery, DeliveredAt, Notes, CreatedAt`.

**Sale:** `_id, BuyerID, SellerID, ProductID, OfferID, SaleDate, SalePrice, DiscountAmount, FinalPrice`.

**Image:** `_id, ProductID, ImageURL, key, IsPrimary, AltText`.
