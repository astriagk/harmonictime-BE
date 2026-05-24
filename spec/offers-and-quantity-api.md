# Offers & Product Quantity — API Reference

All endpoints are under the `/api` prefix. Every response uses the standard
envelope:

```json
{ "message": "<human message>", "data": <payload | null> }
```

Errors use the same shape, with the HTTP status code set and any extra detail in
`data` (e.g. the per-product stock issues).

---

## 1. Offers

Offers are created and managed **only** through the dedicated offer endpoints.
Products never *create* an offer — they just reference one by `OfferID`.

| Method & path | Purpose |
|---|---|
| `POST /api/offers` | Create an offer |
| `GET /api/offers` | List **active** offers (storefront) |
| `GET /api/offers/all` | List **all** offers incl. disabled (admin) |
| `GET /api/offers/:offerID` | Get one offer |
| `PATCH /api/offers/:offerID/status` | Enable / disable an offer |
| `PUT /api/offers/:offerID` | Update / edit an offer |
| `DELETE /api/offers/:offerID` | Delete an offer |

### 1.1 Create an offer — `POST /api/offers`

Payload:

```json
{
  "OfferName": "Summer Sale",
  "Description": "Flat 15% off",
  "DiscountPercentage": 15,
  "StartDate": "2026-06-01T00:00:00.000Z",
  "EndDate": "2026-06-30T23:59:59.000Z",
  "IsActive": true
}
```

- `OfferName` (required, unique), `DiscountPercentage` (required), `StartDate`,
  `EndDate` (required).
- `Description` optional. `IsActive` optional — defaults to `true`.

Response `201`:

```json
{
  "message": "Offer created successfully",
  "data": { "_id": "6650a1b2c3d4e5f600000001" }
}
```

Error `409` if `OfferName` already exists:

```json
{ "message": "OfferName must be unique", "data": null }
```

### 1.2 Enable / disable an offer — `PATCH /api/offers/:offerID/status`

Payload (`IsActive` required):

```json
{ "IsActive": false }
```

Response `200`:

```json
{ "message": "Offer disabled successfully", "data": null }
```

(`"Offer enabled successfully"` when `true`; `404 "Offer not found"` for an
unknown id.)

### 1.3 List offers

- `GET /api/offers` → active offers only (storefront).
- `GET /api/offers/all` → every offer, including disabled (admin).

Response `200`:

```json
{
  "message": "Offers retrieved successfully",
  "data": [
    {
      "_id": "6650a1b2c3d4e5f600000001",
      "OfferName": "Summer Sale",
      "Description": "Flat 15% off",
      "DiscountPercentage": 15,
      "StartDate": "2026-06-01T00:00:00.000Z",
      "EndDate": "2026-06-30T23:59:59.000Z",
      "IsActive": true
    }
  ]
}
```

### 1.4 Update / Get one / Delete

- `PUT /api/offers/:offerID` — any subset of the create fields (at least one) →
  `{ "message": "Offer updated successfully", "data": null }`
- `GET /api/offers/:offerID` → `{ "message": "", "data": { ...offer } }`
- `DELETE /api/offers/:offerID` → `{ "message": "Offer deleted successfully", "data": null }`

---

## 2. Assigning an offer to products

An offer is attached to a product by storing its `_id` in the product's
`OfferID`. Three ways to do it:

### 2.1 During product create / edit (single product)

See section 3 — pass `OfferID` in the create or edit body. `OfferID: null`
detaches it.

### 2.2 Bulk assign / remove — `PUT /api/products/bulk-offer`

One endpoint covers all three scenarios. `AssignProductIDs` get the `OfferID`;
`RemoveProductIDs` have their offer cleared. At least one array is required, so a
single request can assign, remove, or do both at once.

**Scenario 1 — assign one offer to multiple products:**

```json
{
  "OfferID": "6650a1b2c3d4e5f600000001",
  "AssignProductIDs": ["6651aa00000000000000000a", "6651bb00000000000000000b"]
}
```

**Scenario 2 — assign to some and remove from others, at once:**

```json
{
  "OfferID": "6650a1b2c3d4e5f600000001",
  "AssignProductIDs": ["6651aa00000000000000000a"],
  "RemoveProductIDs": ["6651dd00000000000000000d"]
}
```

**Scenario 3 — remove the offer from products:**

```json
{
  "RemoveProductIDs": ["6651aa00000000000000000a", "6651bb00000000000000000b"]
}
```

Response `200` (count of products actually changed):

```json
{
  "message": "Product offers updated successfully",
  "data": { "assigned": 2, "removed": 1 }
}
```

Errors:

| Status | When | Message |
|---|---|---|
| `400` | `AssignProductIDs` present but no valid `OfferID` | `A valid OfferID is required to assign an offer` |
| `404` | `OfferID` is not a real offer | `Offer not found` |
| `400` | a product id is malformed | `Invalid ProductID: <id>` |
| `400` | neither array supplied | schema validation error |

---

## 3. Product quantity

### 3.1 Add quantity on create — `POST /api/products`

Payload (`Quantity` required, integer ≥ 1; `OfferID` optional):

```json
{
  "UserID": "664f00000000000000000001",
  "ProductName": "Rolex Submariner",
  "BrandID": "664f00000000000000000010",
  "CollectionID": "664f00000000000000000020",
  "CategoryID": "664f00000000000000000030",
  "RecipientID": "664f00000000000000000040",
  "Price": 514897,
  "Quantity": 5,
  "OfferID": "6650a1b2c3d4e5f600000001"
}
```

Response `201`:

```json
{
  "message": "Product created successfully",
  "data": { "acknowledged": true, "insertedId": "6651aa00000000000000000a" }
}
```

### 3.2 Update quantity — `PUT /api/products/:productID`

Every field is optional (at least one). To change just the stock:

```json
{ "Quantity": 8 }
```

`Quantity` on edit accepts integer ≥ 0 (0 = no stock). You can combine it with an
offer change in the same call:

```json
{ "Quantity": 3, "OfferID": "6650a1b2c3d4e5f600000001" }
```

Response `200` (enriched product — includes the linked `Offer`, but **not** the
derived stock fields; see 3.3):

```json
{
  "message": "Product updated successfully",
  "data": {
    "_id": "6651aa00000000000000000a",
    "ProductName": "Rolex Submariner",
    "Price": 514897,
    "Quantity": 3,
    "OfferID": "6650a1b2c3d4e5f600000001",
    "Offer": {
      "_id": "6650a1b2c3d4e5f600000001",
      "OfferName": "Summer Sale",
      "DiscountPercentage": 15,
      "IsActive": true
    },
    "IsAvailable": true,
    "Description": {},
    "Details": {},
    "Images": [],
    "DeliveryAndReturns": {}
  }
}
```

### 3.3 How "stock left" works (IMPORTANT)

The `Quantity` field is the **total stock** for the listing and is **NOT
decremented** when someone buys. The same product `_id` backs every unit — we do
not create one document per unit.

"How many are left" is **derived at read time**:

```
SoldCount         = number of times the product appears in PAID checkouts
RemainingQuantity = max(Quantity - SoldCount, 0)
```

So for a product with `Quantity: 5`:

| Event | Quantity (stored) | SoldCount | RemainingQuantity (shown) |
|---|---|---|---|
| Listed | 5 | 0 | 5 |
| 1 unit bought (paid) | 5 | 1 | **4** |
| 3 more bought | 5 | 4 | **1** |
| last one bought | 5 | 5 | **0** → `Status: "Sold"` |

These derived fields appear on the **list** endpoint:

`GET /api/products?UserID=...&IsAvailable=true`

```json
{
  "message": "Products retrieved successfully.",
  "data": [
    {
      "_id": "6651aa00000000000000000a",
      "ProductName": "Rolex Submariner",
      "Quantity": 5,
      "SoldCount": 1,
      "RemainingQuantity": 4,
      "IsSold": true,
      "Status": "Available",
      "IsAvailable": true,
      "Offer": {}
    }
  ]
}
```

> `IsAvailable` query values: `true` (default) / `false` / `all`.
> `Status`: `"Available"` (stock left & visible) / `"Sold"` (RemainingQuantity 0)
> / `"Unavailable"` (stock left but manually hidden).
>
> Note: `GET /api/products/:id` returns `Quantity` and `Offer` but **not**
> `SoldCount` / `RemainingQuantity` / `Status` — those are computed on the list
> endpoint only.

---

## 4. Stock guard at purchase

Buying is blocked when a product is sold out, hidden, or deleted. The check runs
at `POST /api/checkout` and `POST /api/payments/order` (before payment), and is
re-checked at `POST /api/payments/verify` (after payment).

Blocked before payment → `400`:

```json
{
  "message": "Some items can no longer be purchased. Please review your cart.",
  "data": [
    {
      "ProductID": "6651aa00000000000000000a",
      "ProductName": "Rolex Submariner",
      "reason": "Rolex Submariner is out of stock (only 1 left, 2 requested)"
    }
  ]
}
```

Sold out in the race window after payment → `409`:

```json
{
  "message": "Payment received, but some items sold out before the order could be confirmed. A refund will be issued.",
  "data": null
}
```
