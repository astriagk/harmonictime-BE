# Creating a Product in the Inventory

Everything needed to list one watch in the marketplace: which collections store what, which
fields are required, and the order the API calls must be made in.

A "product" is **not** a single document. It is spread across five collections, all linked by
`ProductID`:

| Collection            | Purpose                                   | Required? |
| --------------------- | ----------------------------------------- | --------- |
| `Products`            | Core listing — name, price, stock, refs    | **Yes**   |
| `ProductImages`       | Photos / videos of the watch               | **Yes** in practice (listing looks empty without one) |
| `ProductDetails`      | Watch specs (dial, movement, strap, …)     | Optional but expected |
| `ProductDescriptions` | Long-form marketing copy                   | Optional  |
| `DeliveryReturns`     | Per-product delivery + returns text        | Optional  |

Source of truth: [product.types.ts](src/modules/catalog/product/product.types.ts),
[product.validation.ts](src/modules/catalog/product/product.validation.ts) and the sibling
modules under [src/modules/catalog/](src/modules/catalog/).

---

## 0. Before you start — prerequisites

1. **Authenticated seller.** `POST /api/products` runs behind `authMiddleware` +
   `requireApprovedSeller` ([product.routes.ts:28](src/modules/catalog/product/product.routes.ts#L28)),
   so the account must be an approved seller. Send `Authorization: Bearer <token>`.
2. **GST details, if you've crossed the threshold.** If the seller's cumulative gross sales are
   at or above `SELLER_GST_THRESHOLD` (default ₹2,00,000), GST details must already be on file,
   or product creation returns `403`
   ([product.controller.ts:36-46](src/modules/catalog/product/product.controller.ts#L36-L46)).
3. **Reference IDs exist.** Brand, category, etc. are ObjectId references, not free text — fetch
   or create them first (see [Reference data](#reference-data-lookup-collections)).

All routes below are relative to `/api`.

---

## 1. `Products` — the core listing (required)

`POST /api/products`

### Fields you send

| Field                    | Type            | Required | Notes |
| ------------------------ | --------------- | -------- | ----- |
| `UserID`                 | ObjectId string | **Yes**  | Seller who owns the listing |
| `ProductName`            | string          | **Yes**  | Display title, e.g. "Rolex Submariner Date 41mm" |
| `BrandID`                | ObjectId string | **Yes**  | → `Brands` |
| `CategoryID`             | ObjectId string | **Yes**  | → `Categories` |
| `Price`                  | number          | **Yes**  | In ₹ |
| `Quantity`               | integer ≥ 1     | **Yes**  | Total units in stock for this listing |
| `IsPriceInclusiveOfTax`  | boolean         | **Yes**  | `true` = price already includes 18% GST; `false` = GST-exclusive |
| `CollectionID`           | ObjectId string | No       | → `Collections` (must belong to the same brand) |
| `RecipientID`            | ObjectId string | No       | → `Recipients` (Men / Women / Unisex …) |
| `OfferID`                | ObjectId string | No       | → `Offers`, promotional discount |

### Fields the server sets for you — do **not** send

| Field            | Value on create |
| ---------------- | --------------- |
| `_id`            | generated |
| `IsAvailable`    | `true` |
| `DateListed`     | now |
| `ApprovalStatus` | `"Pending"` |
| `ApprovalNote`   | set by admin on rejection |
| `ApprovedBy`     | admin user id |
| `ApprovedAt`     | timestamp |

> **Stock model:** one `Products` document represents the *whole* stock. Units sold are derived
> by counting the product across paid checkouts — there is no per-unit document, and no separate
> "sold count" field to maintain.

### Example

```http
POST /api/products
Authorization: Bearer <seller-token>
Content-Type: application/json

{
  "UserID": "665f1a2b3c4d5e6f70819200",
  "ProductName": "Omega Seamaster Diver 300M",
  "BrandID": "665f1a2b3c4d5e6f70819201",
  "CollectionID": "665f1a2b3c4d5e6f70819202",
  "CategoryID": "665f1a2b3c4d5e6f70819203",
  "RecipientID": "665f1a2b3c4d5e6f70819204",
  "Price": 485000,
  "Quantity": 1,
  "IsPriceInclusiveOfTax": true
}
```

Response `201` returns the inserted document — **keep its `_id`, it is the `ProductID` for every
step below.**

---

## 2. Upload media, then `ProductImages` (two calls)

### 2a. Upload the files to S3

`POST /api/uploads/images` (public gateway) or `POST /api/upload/images` (seller gateway)

- Multipart form, field name **`images`**, up to **10 files** per call.
- Body fields `userID` and `productID` group the files in S3 under
  `products/<userID>/<productID>/`.
- Accepted: any `image/*`, `video/*`, `application/pdf`, `application/octet-stream`.
  Max **200 MB** per file ([multer.middleware.ts](src/shared/middlewares/multer.middleware.ts)).
- Returns `{ "urls": ["https://…", …] }`.

### 2b. Attach the URLs to the product

`POST /api/product-images`

| Field                  | Type    | Required | Notes |
| ---------------------- | ------- | -------- | ----- |
| `ProductID`            | string  | **Yes**  | |
| `ImageURLs`            | array   | **Yes**  | min 1 item |
| `ImageURLs[].url`      | string  | **Yes**  | URL returned in step 2a |
| `ImageURLs[].key`      | string  | No       | S3 key — store it so deletes can clean up S3 |
| `ImageURLs[].IsPrimary`| boolean | No       | Mark exactly one as the thumbnail |
| `ImageURLs[].mediaType`| enum    | No       | `"image"` \| `"video"` |
| `AltText`              | string  | No       | Accessibility / SEO text |

```json
{
  "ProductID": "665f…",
  "ImageURLs": [
    { "url": "https://…/front.jpg", "key": "products/…/front.jpg", "IsPrimary": true,  "mediaType": "image" },
    { "url": "https://…/back.jpg",  "key": "products/…/back.jpg",  "IsPrimary": false, "mediaType": "image" }
  ],
  "AltText": "Omega Seamaster Diver 300M, blue dial"
}
```

---

## 3. `ProductDetails` — watch specifications

`POST /api/product-details` — one document per product. Every field except `ProductID` is
optional, but this is what the spec table on the product page renders from, so fill in what you
have.

| Field                       | Type            | Notes |
| --------------------------- | --------------- | ----- |
| `ProductID`                 | ObjectId string | **Required** |
| `DialColorID`               | ObjectId string | → `DialColors` |
| `MovementID`                | ObjectId string | → `Movements` (Automatic, Quartz, …) |
| `StrapMaterialID`           | ObjectId string | → `StrapMaterials` |
| `CaseMaterialID`            | ObjectId string | → `CaseMaterials` |
| `WatchMarkersID`            | ObjectId string | → `WatchMarkers` |
| `DeliveryOptionID`          | ObjectId string | → `DeliveryOptions` |
| `Diameter`                  | string          | Free text, e.g. `"42mm"` |
| `WaterResistant`            | string          | Free text, e.g. `"300m / 30 ATM"` |
| `ManufacturerProductNumber` | string          | Reference / model number |
| `Guarantee`                 | string          | e.g. `"2 years international warranty"` |

---

## 4. `ProductDescriptions` — long-form copy

`POST /api/product-descriptions` — one document per product.

| Field               | Type            | Notes |
| ------------------- | --------------- | ----- |
| `ProductID`         | ObjectId string | **Required** |
| `Title`             | string          | Optional heading |
| `Content`           | string          | Main description body |
| `AdditionalDetails` | string          | Condition, box & papers, service history … |

`CreatedAt` is set server-side.

---

## 5. `DeliveryReturns` — per-product policy

`POST /api/delivery-returns` — one document per product.

| Field                 | Type            | Notes |
| --------------------- | --------------- | ----- |
| `ProductID`           | ObjectId string | **Required** |
| `DeliveryInformation` | string          | Shipping timelines, courier, packaging |
| `ReturnsPolicy`       | string          | Window and conditions for returns |

---

## Reference data (lookup collections)

Each of these is a flat `{ _id, <Name> }` collection. `GET` the list to pick an id; only
`Collections` has a parent (`BrandID`).

| Endpoint                  | Collection       | Name field           | Used by |
| ------------------------- | ---------------- | -------------------- | ------- |
| `GET /api/brands`         | `Brands`         | `BrandName`          | `Products.BrandID` |
| `GET /api/collections`    | `Collections`    | `CollectionName` (+ `BrandID`) | `Products.CollectionID` |
| `GET /api/categories`     | `Categories`     | `CategoryName`       | `Products.CategoryID` |
| `GET /api/recipients`     | `Recipients`     | `RecipientName`      | `Products.RecipientID` |
| `GET /api/dial-colors`    | `DialColors`     | `DialColorName`      | `ProductDetails.DialColorID` |
| `GET /api/movements`      | `Movements`      | `MovementName`       | `ProductDetails.MovementID` |
| `GET /api/strap-materials`| `StrapMaterials` | `StrapMaterialName`  | `ProductDetails.StrapMaterialID` |
| `GET /api/case-materials` | `CaseMaterials`  | `CaseMaterialName`   | `ProductDetails.CaseMaterialID` |
| `GET /api/watch-markers`  | `WatchMarkers`   | `WatchMarkerName`    | `ProductDetails.WatchMarkersID` |
| `GET /api/delivery-options`| `DeliveryOptions`| `DeliveryOptionName` | `ProductDetails.DeliveryOptionID` |
| `GET /api/offers`         | `Offers`         | —                    | `Products.OfferID` |

---

## Creation order (checklist)

1. [ ] Resolve reference ids — brand, category, and optionally collection / recipient / offer.
2. [ ] `POST /api/products` → capture `_id` as **ProductID**.
3. [ ] `POST /api/uploads/images` (multipart, with `productID`) → capture `urls`.
4. [ ] `POST /api/product-images` with those urls; mark one `IsPrimary: true`.
5. [ ] `POST /api/product-details` with the specs.
6. [ ] `POST /api/product-descriptions` with the copy.
7. [ ] `POST /api/delivery-returns` with the policy text.
8. [ ] Wait for admin approval — the listing is `Pending` and invisible to buyers until then.

---

## After creation

### Approval

New products are created with `ApprovalStatus: "Pending"`. Buyers only ever see `Approved`
products; the seller sees all their own listings regardless of status.

- `GET  /api/admin/products` — admin queue
- `PUT  /api/admin/products/:productID/approve`
- `PUT  /api/admin/products/:productID/reject` — sets `ApprovalNote`, shown to the seller

### Editing

`PUT /api/products/:productID` — all fields optional, at least one required. Accepts
`ProductName`, `BrandID`, `CollectionID`, `CategoryID`, `RecipientID`, `Price`, `Quantity`
(min 0 here, unlike create), `OfferID`, `IsAvailable`, `IsPriceInclusiveOfTax`, and
`RemovedImageIDs` (array of `ProductImages._id` to delete from both S3 and the DB).

Other useful endpoints:

- `PUT /api/products/availability` — bulk toggle, body `{ "ProductIDs": [...] }`
- `PUT /api/products/bulk-offer` — body `{ OfferID, AssignProductIDs, RemoveProductIDs }`
- `POST /api/products/check-availability` — body `{ items: [{ ProductID, Quantity }] }`
- `DELETE /api/products/:productID`
- `PUT /api/product-details/:productID`, `PUT /api/product-descriptions/:productID`,
  `PUT /api/delivery-returns/product/:productID` — update the side collections
