# Harmoniv Time Backend — Architecture

**Version:** 1.0.0 | **Status:** Active (implemented — mirrors the reference in `Architecture.md`)

> This document maps the Harmoniv Time watch-marketplace domains (the 28 collections
> defined in `spec/database/harmoniv_time.dbml`) onto the same module-based
> architecture used by the reference backend. The flat `controllers / routes / services`
> layout has been migrated into this structure — see **Migration Map** at the end for
> where each old file now lives.
>
> **Implementation notes:**
> - Every module — including the 8 simple `{ _id, <Name> }` reference collections
>   (category, recipient, dial_color, movement, strap_material, case_material,
>   watch_marker, delivery_option) — uses the full 6-file pattern below. No shared
>   factories; each module is self-contained, matching the reference architecture.
> - Routes are split into 5 gateways under `routes/` (auth, public, customer, seller,
>   admin), each aggregating its module routers and mounted under `/api`.
> - Product foreign keys are now stored as `ObjectId` (the DBML-corrected design),
>   so the catalog aggregation no longer needs `$toObjectId` conversions.

---

## Folder Map

```
src/
├── modules/                          ← all feature code lives here
│   │
│   ├── auth/                         ← flat module (single concern)
│   │                                    register · login · verify-email · verify-phone
│   │                                    · reset-password (OTP via email/SMS)
│   │
│   ├── users/                        ← parent module (identity entities)
│   │   ├── user/                     ← Users (profile, CRUD)
│   │   ├── role/                     ← Roles + UserRoles
│   │   └── address/                  ← Address (shipping addresses)
│   │
│   ├── catalog/                      ← parent module (product + reference data)
│   │   ├── product/                  ← Products (core listing)
│   │   ├── product_description/      ← ProductDescription (1:1)
│   │   ├── product_details/          ← ProductDetails (1:1, watch specs)
│   │   ├── product_image/            ← ProductImages (1:N, ImgBB)
│   │   ├── delivery_returns/         ← DeliveryReturns (1:1)
│   │   ├── brand/                    ← Brands
│   │   ├── collection/               ← Collections
│   │   ├── category/                 ← Categories
│   │   ├── recipient/                ← Recipients
│   │   ├── dial_color/               ← DialColors
│   │   ├── movement/                 ← Movements
│   │   ├── strap_material/           ← StrapMaterials
│   │   ├── case_material/            ← CaseMaterials
│   │   ├── watch_marker/             ← WatchMarkers
│   │   └── delivery_option/          ← DeliveryOptions
│   │
│   ├── shopping/                     ← parent module (buyer browse/intent entities)
│   │   ├── cart/                     ← Cart
│   │   ├── wishlist/                 ← Wishlist
│   │   └── recently_viewed/          ← RecentlyViewedProducts
│   │
│   ├── commerce/                     ← parent module (order → pay → ship → sale)
│   │   ├── checkout/                 ← Checkout (the order record)
│   │   ├── checkout_item/            ← CheckoutItems (line groups)
│   │   ├── payment/                  ← Payments (Razorpay order + verify)
│   │   ├── shipment/                 ← Shipments (seller tracking details)
│   │   ├── sale/                     ← Sales (completed transactions)
│   │   └── offer/                    ← Offers (discounts)
│   │
│   ├── file-upload/                  ← flat module (image upload to ImgBB)
│   └── generic/                      ← flat module (bulk insert helper, dev-only)
│
├── shared/                           ← cross-cutting code only, no feature logic
│   ├── config/                       ← env · database (Mongo connect) · razorpay
│   ├── constants/                    ← enums · messages · httpStatus · collections · roles
│   ├── database/                     ← base repository class
│   ├── middlewares/                  ← auth · error · requestLogger · validate · asyncHandler
│   ├── services/                     ← email.service (nodemailer) · sms.service (twilio) · token.service
│   ├── types/                        ← global TS declarations (role.type, etc.)
│   └── utils/                        ← apiError · apiResponse · logger · otp · helpers
│
├── routes/
│   ├── index.ts                      ← aggregates all gateway routes
│   ├── auth/                         ← register, login, verify-email, verify-phone, reset-password
│   ├── public/                       ← product browse, brands, categories, collections,
│   │                                    recipients, active-offers, razorpay-webhook
│   ├── customer/                     ← profile, address, cart, wishlist, recently-viewed,
│   │                                    checkout, payments, sales (purchase history)
│   ├── seller/                       ← products, product-details, product-images,
│   │                                    descriptions, delivery-returns, shipments (tracking)
│   └── admin/                        ← roles, user-roles, brands, collections, categories,
│                                        recipients, dial-colors, movements, strap-materials,
│                                        case-materials, watch-markers, delivery-options, offers
├── app.ts
└── server.ts
```

---

## Per-Module File Structure

Every module (flat or submodule) follows the same 6-file pattern:

```
[module]/
├── [module].controller.ts   ← HTTP handling + business logic
├── [module].repository.ts   ← DB queries / CRUD only
├── [module].routes.ts       ← route definitions + middleware wiring
├── [module].types.ts        ← TypeScript interfaces for this domain
├── [module].validation.ts   ← request validation schemas (Joi)
└── index.ts                 ← barrel export
```

---

## Module Placement Rules

```
New entity/feature?
│
├─ Belongs exclusively to an existing domain?
│   ├─ YES → submodule inside that parent module
│   └─ NO  → its own module
│               ├─ Multiple sub-entities under it? → parent module
│               └─ Single entity?                  → flat module
│
└─ Used by 2+ modules, no domain logic? → shared/
```

### SUBMODULE (inside an existing parent) when:
- Sub-concern of one specific domain
- Cannot exist without the parent (e.g. `product_details` only makes sense inside `catalog`)
- Routes naturally sit under the parent prefix (e.g. `/catalog/brands`)

### PARENT MODULE (with submodules) when all 3 are true:
- Entities share a domain name
- Each has its own separate MongoDB collection
- Each has its own independent route prefix + CRUD set

### FLAT MODULE when:
- Single entity, single concern
- Stands alone — other domains reference it but don't own it (e.g. `auth`, `file-upload`)

### `shared/` when:
- Used by 2+ different modules
- No domain-specific business logic

---

## Migration Map (current → target)

The repo today uses a flat layout. This is where each existing file lands:

| Current file | Target module |
|---|---|
| `controllers/userController.ts` (login/register/OTP/reset) | `modules/auth/` |
| `controllers/userController.ts` (CRUD/profile) | `modules/users/user/` |
| `controllers/userController.ts` (address fns) | `modules/users/address/` |
| `controllers/roleController.ts` + `types/role.type.ts` | `modules/users/role/` |
| `controllers/productController.ts` | `modules/catalog/product/` |
| `controllers/productDetails/*Controller.ts` | matching `modules/catalog/*` submodule |
| `controllers/productDetails/uploadController.ts` + `productImagesController` (upload fns) | `modules/file-upload/` |
| `controllers/cartController.ts` | `modules/shopping/cart/` |
| `controllers/wishlistController.ts` | `modules/shopping/wishlist/` |
| `controllers/recentlyViewedProductsController.ts` | `modules/shopping/recently_viewed/` |
| `controllers/checkout/checkoutController.ts` | `modules/commerce/checkout/` |
| `controllers/checkout/checkoutItemsController.ts` | `modules/commerce/checkout_item/` |
| `controllers/paymentController.ts` | `modules/commerce/payment/` |
| _(new — Shipments)_ | `modules/commerce/shipment/` |
| `controllers/salesController.ts` | `modules/commerce/sale/` |
| `controllers/offerController.ts` | `modules/commerce/offer/` |
| `controllers/genericController.ts` | `modules/generic/` |
| `config/db.ts` | `shared/config/` |
| `middlewares/*` | `shared/middlewares/` |
| `services/userService.ts` (email/OTP) | `shared/services/email.service.ts` |
| `utils/responseUtil.ts`, `utils/logger.ts` | `shared/utils/` |
| `validations/userValidation.ts` | `modules/auth/auth.validation.ts` |
| `routes/*` | split into `routes/{auth,public,customer,seller,admin}/` |
| `models/*` (empty stubs) | replaced by per-module `*.types.ts` + `*.repository.ts` |
