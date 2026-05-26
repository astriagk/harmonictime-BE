# User Reviews API

Reviews left by buyers for a seller, submitted after purchasing a product.

Base path: `/api/user-reviews`

---

## Endpoints

### POST `/api/user-reviews`
Submit a review for a seller. Pass the `ProductID` — the seller is resolved automatically.

**Request body**
```json
{
  "ProductID": "664f1a2b3c4d5e6f7a8b9c0d",
  "Rating": 5,
  "Subject": "Great seller!",
  "Email": "buyer@example.com",
  "Comment": "Fast shipping, item exactly as described.",
  "Name": "John Doe"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `ProductID` | string | Yes | ID of the product purchased |
| `Rating` | number | Yes | Integer 1–5 |
| `Subject` | string | Yes | Short title for the review |
| `Email` | string | Yes | Valid email address |
| `Comment` | string | Yes | Full review text |
| `Name` | string | No | Reviewer display name |

**Response `201`**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "_id": "664f1a2b3c4d5e6f7a8b9c0e",
    "UserID": "664f1a2b3c4d5e6f7a8b9c01",
    "ProductID": "664f1a2b3c4d5e6f7a8b9c0d",
    "Rating": 5,
    "Subject": "Great seller!",
    "Name": "John Doe",
    "Email": "buyer@example.com",
    "Comment": "Fast shipping, item exactly as described.",
    "CreatedAt": "2026-05-26T10:00:00.000Z"
  }
}
```

**Errors**
| Status | Reason |
|---|---|
| `400` | Validation failed (missing/invalid fields) |
| `404` | Product not found |

---

### GET `/api/user-reviews/user/:userID`
Get all reviews for a seller along with their average rating and total review count.

**Example**
```
GET /api/user-reviews/user/664f1a2b3c4d5e6f7a8b9c01
```

**Response `200`**
```json
{
  "success": true,
  "message": "",
  "data": {
    "averageRating": 4.75,
    "totalReviews": 12,
    "reviews": [
      {
        "_id": "664f1a2b3c4d5e6f7a8b9c0e",
        "UserID": "664f1a2b3c4d5e6f7a8b9c01",
        "ProductID": "664f1a2b3c4d5e6f7a8b9c0d",
        "Rating": 5,
        "Subject": "Great seller!",
        "Name": "John Doe",
        "Email": "buyer@example.com",
        "Comment": "Fast shipping, item exactly as described.",
        "CreatedAt": "2026-05-26T10:00:00.000Z"
      }
    ]
  }
}
```

---

### GET `/api/user-reviews/:reviewID`
Get a single review by its ID.

**Example**
```
GET /api/user-reviews/664f1a2b3c4d5e6f7a8b9c0e
```

**Response `200`**
```json
{
  "success": true,
  "message": "",
  "data": {
    "_id": "664f1a2b3c4d5e6f7a8b9c0e",
    "UserID": "664f1a2b3c4d5e6f7a8b9c01",
    "ProductID": "664f1a2b3c4d5e6f7a8b9c0d",
    "Rating": 5,
    "Subject": "Great seller!",
    "Name": "John Doe",
    "Email": "buyer@example.com",
    "Comment": "Fast shipping, item exactly as described.",
    "CreatedAt": "2026-05-26T10:00:00.000Z"
  }
}
```

**Errors**
| Status | Reason |
|---|---|
| `404` | Review not found |

---

### GET `/api/user-reviews`
Get all user reviews (no filters).

**Response `200`**
```json
{
  "success": true,
  "message": "",
  "data": [ ...reviews ]
}
```

---

### DELETE `/api/user-reviews/:reviewID`
Delete a review by its ID.

**Response `200`**
```json
{
  "success": true,
  "message": "Review deleted successfully",
  "data": null
}
```

**Errors**
| Status | Reason |
|---|---|
| `404` | Review not found |

---

## Rating display guide

| Stars | Label |
|---|---|
| 5 | Excellent |
| 4 | Good |
| 3 | Average |
| 2 | Poor |
| 1 | Terrible |

---

## Integration notes

- Call `GET /api/user-reviews/user/:userID` on the seller profile page to display their star rating and reviews list.
- Use `averageRating` and `totalReviews` from the response to render the summary badge (e.g. ★ 4.75 · 12 reviews).
- Submit reviews via `POST /api/user-reviews` after a buyer's order is delivered — pass the `ProductID` from the order, not the seller's `UserID`.
- `Name` is optional; if not provided, display "Anonymous" in the UI.
