# Krono Square — Platform Journey Document

**Platform:** Krono Square (Watch Marketplace)
**Roles:** Admin · Seller · Buyer
**Last Updated:** 2026-05-27

---

## Table of Contents

1. [Seller Journey](#1-seller-journey)
   - [1.1 Registration & Account Setup](#11-registration--account-setup)
   - [1.2 Individual vs Business Account](#12-individual-vs-business-account)
   - [1.3 GST Onboarding](#13-gst-onboarding)
   - [1.4 Bank Account Setup](#14-bank-account-setup)
   - [1.5 Product Listing](#15-product-listing)
   - [1.6 Product Images & Media](#16-product-images--media)
   - [1.7 Order Fulfillment & Shipment](#17-order-fulfillment--shipment)
   - [1.8 Earnings & Wallet](#18-earnings--wallet)
   - [1.9 Withdrawal Request](#19-withdrawal-request)
   - [1.10 Chat with Buyers](#110-chat-with-buyers)
2. [Buyer Journey](#2-buyer-journey)
   - [2.1 Registration & Login](#21-registration--login)
   - [2.2 Browse & Discover](#22-browse--discover)
   - [2.3 Cart & Wishlist](#23-cart--wishlist)
   - [2.4 Address Management](#24-address-management)
   - [2.5 Checkout & Payment](#25-checkout--payment)
   - [2.6 Order Tracking](#26-order-tracking)
   - [2.7 Reviews & Ratings](#27-reviews--ratings)
   - [2.8 Chat with Sellers](#28-chat-with-sellers)
3. [Admin Journey](#3-admin-journey)
   - [3.1 Seller Verification](#31-seller-verification)
   - [3.2 GST Verification](#32-gst-verification)
   - [3.3 Product Moderation](#33-product-moderation)
   - [3.4 Withdrawal Management](#34-withdrawal-management)
   - [3.5 User Management](#35-user-management)
   - [3.6 Offers & Promotions](#36-offers--promotions)
4. [Platform Business Rules](#4-platform-business-rules)
   - [4.1 Commission & GST Logic](#41-commission--gst-logic)
   - [4.2 Earnings Lifecycle](#42-earnings-lifecycle)
   - [4.3 Product Approval States](#43-product-approval-states)
   - [4.4 Seller Verification States](#44-seller-verification-states)
5. [Data Models Reference](#5-data-models-reference)

---

## 1. Seller Journey

### 1.1 Registration & Account Setup

A seller starts by creating an account through the same registration endpoint as any user.

**Endpoint:** `POST /api/auth/register`

**Required Fields:**
```json
{
  "email": "seller@example.com",
  "password": "Min8Chars",
  "accountType": "individual" | "business",
  "phone": "+919876543210"
}
```

> **Phone is mandatory for all sellers.** It is used for OTP-based password reset via SMS.

**What happens internally:**
- Password is bcrypt-hashed before storage
- User is assigned the **Customer role (ID = 3)** by default
- `sellerVerificationStatus` is set to `"Unverified"`
- A JWT access token (1h) is returned immediately; the seller can start using the platform

**To become a seller**, the user must later be assigned the Seller role (ID = 2) by an admin or via seller onboarding flow.

---

### 1.2 Individual vs Business Account

At registration, the seller declares their account type. This determines the onboarding path.

| Field | Individual | Business |
|---|---|---|
| `accountType` | `"individual"` | `"business"` |
| `businessName` | Not required | Not required |
| GST required immediately | No | No (triggered by ₹2,00,000 threshold) |
| Phone required | **Yes** | **Yes** |

**Business registration example:**
```json
{
  "email": "business@example.com",
  "password": "SecurePass1",
  "accountType": "business",
  "phone": "+919123456789"
}
```

---

### 1.3 GST Onboarding

GST details are **mandatory once the seller's cumulative sales reach ₹2,00,000**. Until then, listing is allowed without GST. Once the threshold is crossed, new product listings are blocked until GST details are submitted and verified.

**Submit GST Details:** `POST /api/gst` *(authenticated)*

```json
{
  "GSTIN": "27AAPFU0939F1ZV",
  "LegalBusinessName": "Prestige Watches Pvt Ltd",
  "TradeName": "Prestige Watches",          // optional
  "BusinessType": "Private Limited",         // optional
  "RegisteredAddress": "123 MG Road, Pune", // optional
  "PinCode": "411001",                       // optional
  "State": "Maharashtra"                     // optional
}
```

**GSTIN Validation:** Indian standard format — 2-digit state code + 10-char PAN + entity digit + `Z` + check digit.

**Business types accepted:** `"Proprietorship"`, `"Partnership"`, `"Private Limited"`, `"LLP"`, `"Other"`

**After submission:**
- `IsVerified = false` (pending admin review)
- GST details are visible to admin in the seller profile
- Seller can update: `PUT /api/gst/:id`

**Once admin verifies GST,** `IsVerified` is set to `true` and the threshold block is lifted.

---

### 1.4 Bank Account Setup

Sellers must add and verify a bank account before they can withdraw earnings.

**Add Bank Account:** `POST /api/bank-accounts` *(authenticated)*

```json
{
  "AccountHolderName": "Rahul Sharma",
  "AccountNumber": "1234567890",
  "IFSC": "SBIN0001234",
  "BankName": "State Bank of India",
  "IsDefault": true
}
```

**Verify Account:** `POST /api/bank-accounts/:accountID/verify`
- Triggers penny-drop verification
- On success: `IsVerified = true`, `VerifiedName` captured from the bank response

> A seller can hold multiple bank accounts. Only the `IsDefault = true` account is used for payouts unless overridden at withdrawal time.

---

### 1.5 Product Listing

**Create Product:** `POST /api/products` *(authenticated)*

```json
{
  "ProductName": "Rolex Submariner Date",
  "BrandID": "<brandObjectId>",
  "CollectionID": "<collectionObjectId>",
  "CategoryID": "<categoryObjectId>",
  "RecipientID": "<recipientObjectId>",
  "Price": 850000,
  "Quantity": 1,
  "IsPriceInclusiveOfTax": true
}
```

**`IsPriceInclusiveOfTax`:** If `true`, the listed price already includes 18% GST and the platform will calculate it backward. If `false`, GST is added on top during commission calculation.

**Product approval flow:**

```
Seller lists product → ApprovalStatus = "Pending"
                    ↓
        Admin reviews the listing
                    ↓
         Approved → visible to buyers
         Rejected → invisible; seller sees reason note
```

> Products with `ApprovalStatus = "Pending"` or `"Rejected"` are **never visible** to buyers. Sellers can always see their own products in all states.

**Edit Product:** `PUT /api/products/:productID`
- Seller can edit name, price, quantity, brand, collection, category, recipient, availability, and tax setting at any time.
- Editing a product does **not** reset the approval status.

**Add Description:** `POST /api/product-descriptions`
```json
{
  "ProductID": "<productObjectId>",
  "Title": "Luxury Diving Watch",
  "Content": "300m water-resistant automatic movement...",
  "AdditionalDetails": "Box and papers included"
}
```

**Add Specifications:** `POST /api/product-details`
```json
{
  "ProductID": "<productObjectId>",
  "DialColorID": "<dialColorId>",
  "MovementID": "<movementId>",
  "StrapMaterialID": "<strapMaterialId>",
  "CaseMaterialID": "<caseMaterialId>",
  "WatchMarkersID": "<watchMarkersId>",
  "DeliveryOptionID": "<deliveryOptionId>",
  "Diameter": 40,
  "WaterResistant": "300m",
  "ManufacturerProductNumber": "116610LN",
  "Guarantee": "5 Year International"
}
```

---

### 1.6 Product Images & Media

**Step 1 — Upload files to S3:** `POST /api/uploads/images` *(multipart/form-data, up to 10 files)*

Response returns an array of `{ imageId, imageURL, key }` objects.

Files are stored at path: `products/<userID>/<productID>/` in AWS S3.

**Step 2 — Link images to product:** `POST /api/product-images`
```json
{
  "ProductID": "<productObjectId>",
  "ImageURL": "https://s3.amazonaws.com/.../watch.jpg",
  "key": "products/userId/productId/watch.jpg",
  "IsPrimary": true,
  "AltText": "Rolex Submariner front view",
  "mediaType": "image"
}
```

**`mediaType`:** `"image"` or `"video"` — both are supported.

**Set primary image:** `PUT /api/product-images/:imageID` with `{ "IsPrimary": true }`

Only one image per product can be `IsPrimary = true`. The primary image is used as the product thumbnail on listing pages.

---

### 1.7 Order Fulfillment & Shipment

When a buyer purchases a product, the seller receives the order.

**Get Orders:** `GET /api/checkout/seller/:sellerID` *(authenticated)*

Returns all `Checkout` records where the seller's products were purchased.

**Create Shipment:** `POST /api/shipments` *(authenticated)*

```json
{
  "CheckoutID": "<checkoutObjectId>",
  "Courier": "BlueDart",
  "TrackingNumber": "1234567890",
  "TrackingURL": "https://bluedart.com/track/1234567890",
  "EstimatedDelivery": "2026-06-05"
}
```

**Update Shipment Status:** `PUT /api/shipments/:shipmentID`

**Status progression:**
```
Pending → Shipped → InTransit → OutForDelivery → Delivered
```

> The seller must mark the shipment as `"Delivered"`. Earnings become available 7 days after the `Delivered` status is set.

---

### 1.8 Earnings & Wallet

Every time a buyer's payment is verified, the platform automatically creates an earning record for each product sold.

**Get Wallet Summary:** `GET /api/wallet` *(authenticated)*

**Earning calculation per product:**

```
GrossAmount        = Product.Price − OfferDiscountAmount
CommissionAmount   = GrossAmount × 10% (PLATFORM_COMMISSION_RATE)
NetAmount          = GrossAmount − CommissionAmount
GSTAmount          = NetAmount × 18% (if IsPriceInclusiveOfTax = true)
NetAmountAfterGST  = NetAmount − GSTAmount     ← actual payout amount
```

**Earning lifecycle:**
```
Pending   → sale created, delivery not confirmed
Available → delivery confirmed + 7-day hold elapsed
Requested → seller has raised a withdrawal
Settled   → admin has paid out
```

Only earnings in `"Available"` status can be included in a withdrawal request.

---

### 1.9 Withdrawal Request

**Request Payout:** `POST /api/withdrawals` *(authenticated)*

- Aggregates all `"Available"` earnings
- Creates a withdrawal record with bank snapshot (frozen at request time)
- Marks those earnings as `"Requested"`

```json
{
  "BankAccountID": "<bankAccountObjectId>"
}
```

**View Withdrawal History:** `GET /api/withdrawals?status=Paid` *(authenticated)*

**Cancel Withdrawal:** `PUT /api/withdrawals/:withdrawalID/cancel`
- Only possible while status is `"Pending"`
- Releases earnings back to `"Available"`

**Withdrawal record contains:**
```
Amount              = sum of all selected earnings (NetAmountAfterGST)
TotalGSTDeducted    = cumulative GST across selected earnings
FinalPayableAmount  = Amount − TotalGSTDeducted
BankSnapshot        = frozen copy of bank account details at request time
```

**Status flow:**
```
Pending → Paid       (admin processes the bank transfer)
Pending → Rejected   (admin rejects with reason; earnings go back to Available)
```

When paid, the seller receives an email confirmation with the UTR / transaction reference.

---

### 1.10 Chat with Buyers

Sellers can respond to buyer queries on any of their listed products.

**View All Threads:** `GET /api/chat/threads` *(authenticated)*

**Get Messages in Thread:** `GET /api/chat/threads/:threadId/messages`

**Reply to Buyer:** `POST /api/chat/threads/:threadId/messages`
```json
{
  "text": "Yes, this watch comes with original box and papers."
}
```

**Close Thread:** `PATCH /api/chat/threads/:threadId/close`

---

## 2. Buyer Journey

### 2.1 Registration & Login

**Register:** `POST /api/auth/register`
```json
{
  "email": "buyer@example.com",
  "password": "MyPassword1",
  "accountType": "individual"
}
```

> Phone is optional for buyers at registration. It is required only if the buyer wants to use phone-based OTP password reset.

**Login:** `POST /api/auth/login`
```json
{
  "email": "buyer@example.com",
  "password": "MyPassword1"
}
```

Response:
```json
{
  "accessToken": "...",   // 1-hour JWT
  "refreshToken": "..."  // 30-day JWT
}
```

**Refresh Token:** `POST /api/auth/refresh-token`

**Password Reset Flow:**
1. `POST /api/auth/verify-email` — sends OTP to registered email (OTP valid 10 minutes)
2. `POST /api/auth/reset-password` — provide OTP + new password

---

### 2.2 Browse & Discover

All browse endpoints are **public** (no auth required).

| What | Endpoint |
|---|---|
| Browse all approved products | `GET /api/products` |
| Product detail page | `GET /api/products/:productID` |
| Product description | `GET /api/product-descriptions/:productID` |
| Product specifications | `GET /api/product-details/:productID` |
| Product images & video | `GET /api/product-images/product/:productID` |

**Reference data (for filters/dropdowns):**

| Data | Endpoint |
|---|---|
| Brands | `GET /api/brands` |
| Categories | `GET /api/categories` |
| Collections | `GET /api/collections` |
| Recipients (gift types) | `GET /api/recipients` |
| Dial Colors | `GET /api/dial-colors` |
| Movements | `GET /api/movements` |
| Strap Materials | `GET /api/strap-materials` |
| Case Materials | `GET /api/case-materials` |
| Watch Markers | `GET /api/watch-markers` |
| Delivery Options | `GET /api/delivery-options` |
| Delivery & Returns | `GET /api/delivery-returns` |

> Only products with `ApprovalStatus = "Approved"` and `IsAvailable = true` appear in public listings.

**Track Recently Viewed:** `POST /api/recently-viewed` *(authenticated)*
```json
{ "productID": "<productObjectId>" }
```

---

### 2.3 Cart & Wishlist

**Add to Cart:** `POST /api/cart` *(authenticated)*
```json
{ "productID": "<productObjectId>", "quantity": 1 }
```

**View Cart:** `GET /api/cart/user/:userID`

**Update Quantity:** `PUT /api/cart/:cartID`

**Remove from Cart:** `DELETE /api/cart/:cartID`

---

**Add to Wishlist:** `POST /api/wishlist` *(authenticated)*
```json
{ "productID": "<productObjectId>" }
```

**View Wishlist:** `GET /api/wishlist/user/:userID`

**Move to Cart:** `POST /api/wishlist/:wishlistID/move-to-cart`

**Remove from Wishlist:** `DELETE /api/wishlist/:wishlistID`

---

### 2.4 Address Management

Buyers save delivery addresses before or during checkout.

**Add Address:** `POST /api/address` *(authenticated)*
```json
{
  "FirstName": "Priya",
  "LastName": "Kapoor",
  "AddressLine1": "Flat 4B, Sunrise Apartments",
  "AddressLine2": "MG Road",
  "City": "Bengaluru",
  "State": "Karnataka",
  "PostalCode": "560001",
  "Country": "India",
  "Phone": "+919876543210",
  "IsDefault": true
}
```

**List Addresses:** `GET /api/address/user/:userID`

**Update Address:** `PUT /api/address/:addressID`

---

### 2.5 Checkout & Payment

The platform uses **Razorpay** for payment processing.

**Step 1 — Create Order:** `POST /api/payments/create-order` *(authenticated)*
```json
{
  "products": [
    { "productID": "<id>", "quantity": 1, "price": 850000 }
  ],
  "addressData": {
    "FirstName": "Priya",
    "AddressLine1": "Flat 4B, Sunrise Apartments",
    "City": "Bengaluru",
    "State": "Karnataka",
    "PostalCode": "560001",
    "Country": "India",
    "Phone": "+919876543210"
  },
  "totalAmount": 850000
}
```

**What happens:**
1. Backend validates product stock availability
2. Creates a Razorpay order via the Razorpay API
3. Stores a `Payment` record with status `"Created"` and Draft data (address + checkout items)
4. Returns `razorpayOrderID` and `amount` to the frontend

**Step 2 — Open Razorpay Payment Sheet** *(frontend)*

The frontend renders the Razorpay checkout modal using the `razorpayOrderID`.

**Step 3 — Verify Payment:** `POST /api/payments/verify` *(authenticated)*
```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "sig_xxxxx"
}
```

**What happens on successful verification:**
1. HMAC signature verified against Razorpay secret
2. Stock is re-validated (race condition guard)
   - If sold out since Step 1: payment marked `"RefundPending"`, error returned
   - If still available: proceeds
3. Address record persisted to `Address` collection
4. `Checkout` record created with `PaymentStatus = "Paid"`, `DeliveryStatus = "Pending"`
5. Seller earning record created for each product
6. Product `IsAvailable` set to `false` (quantity depleted)
7. Cart items cleared
8. Order confirmation email sent to buyer

**Payment statuses:** `Created` → `Verified` | `Failed` | `RefundPending`

---

### 2.6 Order Tracking

**View My Orders:** `GET /api/checkout/user/:userID` *(authenticated)*

**Order Detail:** `GET /api/checkout/:checkoutID` *(authenticated)*

**Track Shipment:** `GET /api/shipments/checkout/:checkoutID` *(authenticated)*

Shipment includes `Courier`, `TrackingNumber`, `TrackingURL`, and current `ShipmentStatus`.

**Delivery status progression:**
```
Pending → Shipped → InTransit → OutForDelivery → Delivered
```

---

### 2.7 Reviews & Ratings

Buyers can submit reviews after purchase.

**Review a Product:** `POST /api/reviews`
```json
{
  "ProductID": "<productObjectId>",
  "Rating": 5,
  "Name": "Priya K.",
  "Email": "priya@example.com",
  "Comment": "Absolutely stunning timepiece. Arrived in perfect condition."
}
```

> Product reviews allow guest submissions — `Name` and `Email` are required even without an account.

**Get Product Reviews:** `GET /api/reviews/product/:productID`

Response includes:
- Individual review records
- Summary: `averageRating`, `totalCount`, `countByStar` (1 through 5)

---

**Review a Seller:** `POST /api/user-reviews` *(after purchase)*
```json
{
  "UserID": "<sellerObjectId>",
  "ProductID": "<productObjectId>",
  "Rating": 4,
  "Subject": "Great seller, fast shipping",
  "Name": "Priya K.",
  "Email": "priya@example.com",
  "Comment": "Very responsive and well-packaged."
}
```

**Get Seller Reviews:** `GET /api/user-reviews/user/:sellerID`

---

### 2.8 Chat with Sellers

Buyers can message a seller directly about a specific product.

**Start or Get a Thread:** `POST /api/chat/threads` *(authenticated)*
```json
{
  "productID": "<productObjectId>",
  "sellerID": "<sellerObjectId>"
}
```

If a thread already exists for this buyer-seller-product combination, the existing thread is returned.

**Send Message:** `POST /api/chat/threads/:threadId/messages`
```json
{ "text": "Is this watch available for urgent delivery to Delhi?" }
```

**View All My Threads:** `GET /api/chat/threads`

**Get Thread Messages:** `GET /api/chat/threads/:threadId/messages`

---

## 3. Admin Journey

Admins are users with `RoleID = 1`. All admin endpoints are protected by both `authMiddleware` and `requireAdmin` middleware.

### 3.1 Seller Verification

When a seller submits their GST details and onboarding information, the admin reviews and approves or rejects.

**List Sellers by Status:** `GET /api/admin/sellers?status=Unverified|Pending|Approved|Rejected`

**View Full Seller Profile:** `GET /api/admin/sellers/:sellerID`

Returns:
- User info: email, phone, account type, verification status
- GST details (if submitted)
- Bank accounts (if added)
- Product stats: total, approved, pending, rejected counts

**Approve Seller:** `PUT /api/admin/sellers/:sellerID/approve`
- Sets `sellerVerificationStatus = "Approved"`
- Records `sellerVerifiedBy` (admin ID) and `sellerVerifiedAt`

**Reject Seller:** `PUT /api/admin/sellers/:sellerID/reject`
```json
{ "note": "GST certificate does not match business name provided." }
```
- Sets `sellerVerificationStatus = "Rejected"`
- `sellerVerificationNote` stores the reason (visible to seller)

**Request More Info:** `PUT /api/admin/sellers/:sellerID/request-info`
```json
{ "note": "Please upload a clearer copy of your GST registration certificate." }
```
- Status stays `"Pending"`, note is updated

**Seller verification state machine:**
```
Unverified  (newly registered)
     ↓  seller submits GST/docs
  Pending
     ↓
  Approved  ←→  Rejected
                (with note)
```

---

### 3.2 GST Verification

**List All GST Submissions:** `GET /api/admin/gst`

**Verify GST:** `PUT /api/admin/gst/:id/verify`
- Sets `IsVerified = true`
- This unblocks product listing for sellers who crossed the ₹2,00,000 threshold

---

### 3.3 Product Moderation

All new product listings start as `"Pending"` and are invisible to buyers until approved.

**List Products by Status:** `GET /api/admin/products?status=Pending|Approved|Rejected`

**Approve Product:** `PUT /api/admin/products/:productID/approve`
- Sets `ApprovalStatus = "Approved"`
- Records `ApprovedBy` (admin ID) and `ApprovedAt`
- Product immediately becomes visible to buyers

**Reject Product:** `PUT /api/admin/products/:productID/reject`
```json
{ "note": "Watch images are too dark. Please upload clear, well-lit photos." }
```
- Sets `ApprovalStatus = "Rejected"`
- `ApprovalNote` stores the reason (visible to seller in their product list)

---

### 3.4 Withdrawal Management

Sellers request payouts; admins process the actual bank transfers and mark them as paid.

**List Withdrawal Requests:** `GET /api/admin/withdrawals?status=Pending`

**Mark as Paid:** `PUT /api/admin/withdrawals/:withdrawalID/pay`
```json
{
  "reference": "NEFT2026052700123",
  "notes": "Processed via SBI NEFT at 2:30 PM"
}
```

**What happens:**
- `Withdrawal.Status = "Paid"`
- All linked earnings set to `"Settled"` (permanently locked)
- `Reference` (UTR / transaction ID) stored for audit
- Seller receives a "Withdrawal Paid" email with the reference number

**Reject Withdrawal:** `PUT /api/admin/withdrawals/:withdrawalID/reject`
```json
{ "notes": "Bank account verification pending. Please re-verify your account." }
```

**What happens:**
- `Withdrawal.Status = "Rejected"`
- All linked earnings released back to `"Available"`
- Seller receives a "Withdrawal Rejected" email with the reason

---

### 3.5 User Management

**List All Users:** `GET /api/admin/users`

**User Detail:** `GET /api/admin/users/:userID`

**Update User:** `PUT /api/admin/users/:userID`

**Delete User:** `DELETE /api/admin/users/:userID`

---

### 3.6 Offers & Promotions

Admins create time-bounded discount offers that sellers can assign to their products.

**Create Offer:** `POST /api/offers`
```json
{
  "OfferName": "Summer Sale",
  "Description": "Flat 15% off on all luxury watches",
  "DiscountPercentage": 15,
  "StartDate": "2026-06-01",
  "EndDate": "2026-06-30",
  "IsActive": true
}
```

**Toggle Offer Active/Inactive:** `PATCH /api/offers/:offerID/status`

**Sellers assign offers to their products:**
`PUT /api/products/bulk-offer`
```json
{
  "productIDs": ["<id1>", "<id2>"],
  "offerID": "<offerObjectId>"
}
```

To remove an offer from products, pass `offerID: null`.

---

## 4. Platform Business Rules

### 4.1 Commission & GST Logic

| Config | Value |
|---|---|
| Platform commission rate | 10% of GrossAmount |
| Buyer commission rate | 2% added on top of price shown to buyer |
| GST rate | 18% |
| Payout hold period | 7 days after delivery |
| GST registration threshold | ₹2,00,000 cumulative sales |

**Earning breakdown example:**

```
Product Price (listed)          ₹1,00,000
Offer Discount (10%)          − ₹10,000
                              ----------
GrossAmount                     ₹90,000
Platform Commission (10%)     − ₹9,000
                              ----------
NetAmount                       ₹81,000
GST (18% of ₹81,000)          − ₹14,580
                              ----------
NetAmountAfterGST (payout)      ₹66,420
```

> GST is only deducted from the seller payout if `IsPriceInclusiveOfTax = true`.

---

### 4.2 Earnings Lifecycle

```
Payment Verified
       ↓
   Pending         (delivery not yet confirmed)
       ↓
  (Delivered + 7 days)
       ↓
  Available         (seller can now withdraw)
       ↓
  Requested         (seller submitted withdrawal)
       ↓
   Settled          (admin paid; funds disbursed)

Exception paths:
  Requested → Available   (seller cancels withdrawal, OR admin rejects it)
```

---

### 4.3 Product Approval States

```
Seller lists product
        ↓
     Pending          (not visible to buyers)
        ↓
  Admin reviews
        ↓
   Approved  ──────────────────→  visible to buyers
   Rejected  → seller sees note, can relist after editing
```

---

### 4.4 Seller Verification States

```
Register
    ↓
 Unverified     (just signed up)
    ↓  (submits GST details)
  Pending       (awaiting admin review)
    ↓
 Approved       (fully operational seller)
 Rejected       (see rejection note; can re-submit after correction)

Note: Admin can also set status back to Pending via "Request More Info"
```

---

## 5. Data Models Reference

### User
```
_id, email, password (hashed), phone,
accountType ("individual" | "business"), businessName,
status, profilePicUrl,
sellerVerificationStatus ("Unverified" | "Pending" | "Approved" | "Rejected"),
sellerVerificationNote, sellerVerifiedBy, sellerVerifiedAt,
otp (hashed), otpExpiry, refreshTokenHash,
acceptedTerms, termsAcceptedAt, dateCreated
```

### Product
```
_id, UserID (seller), ProductName,
BrandID, CollectionID, CategoryID, RecipientID,
Price, Quantity, OfferID,
IsPriceInclusiveOfTax, IsAvailable,
ApprovalStatus ("Pending" | "Approved" | "Rejected"),
ApprovalNote, ApprovedBy, ApprovedAt, DateListed
```

### Payment
```
_id, UserID, Amount (in paise), Currency,
RazorpayOrderID, RazorpayPaymentID, RazorpaySignature,
PaymentStatus ("Created" | "Verified" | "Failed" | "RefundPending"),
PaymentMethod, CheckoutID, AddressID,
Draft { address, checkoutItems },
PaidAt, CreatedAt
```

### Checkout (Order)
```
_id, UserID, AddressID, TotalAmount,
PaymentStatus ("Paid"),
DeliveryStatus ("Pending" | "Shipped" | "InTransit" | "OutForDelivery" | "Delivered"),
ProductIDs (array), CheckoutDate
```

### SellerEarning
```
_id, SellerID, CheckoutID, ProductID,
OfferDiscountPercentage, OfferDiscountAmount,
GrossAmount, CommissionRate, CommissionAmount, NetAmount,
IsTaxInclusive, GSTRate, GSTAmount, NetAmountAfterGST,
Status ("Pending" | "Available" | "Requested" | "Settled"),
SaleDate, AvailableAt, WithdrawalID, CreatedAt
```

### Withdrawal
```
_id, SellerID, BankAccountID,
BankSnapshot { AccountHolderName, AccountNumber, IFSC, BankName },
Amount, TotalGSTDeducted, FinalPayableAmount,
EarningIDs (array),
Status ("Pending" | "Approved" | "Paid" | "Rejected"),
Reference, Notes, RequestedAt, ProcessedAt, ProcessedBy
```

### SellerGSTDetails
```
_id, SellerID, GSTIN, LegalBusinessName, TradeName,
BusinessType, RegisteredAddress, PinCode, State, IsVerified, CreatedAt
```

### SellerBankAccount
```
_id, SellerID, AccountHolderName, AccountNumber, IFSC, BankName,
IsDefault, IsVerified,
VerificationStatus ("unverified" | "verified" | "failed"),
VerifiedAt, VerifiedName, CreatedAt
```

### Shipment
```
_id, CheckoutID, SellerID, Courier,
TrackingNumber, TrackingURL, ShipmentStatus,
ShippedAt, EstimatedDelivery, DeliveredAt, Notes, CreatedAt
```

### Review (Product)
```
_id, ProductID, Rating (1-5), Name, Email, Comment, CreatedAt
```

### UserReview (Seller)
```
_id, UserID (seller), ProductID, Rating (1-5),
Subject, Name, Email, Comment, CreatedAt
```

### ChatThread
```
_id, ProductID, BuyerID, SellerID,
Status ("open" | "closed"), CreatedAt, UpdatedAt
```

### ChatMessage
```
_id, ThreadID, SenderID, SenderRole ("buyer" | "seller"),
Text, IsRead, CreatedAt
```
