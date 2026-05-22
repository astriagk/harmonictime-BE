# CMS Site Content & Image Upload — Postman Guide

How to manage dynamic homepage blocks (hero slider, category banners, video area, or
any new type) using Postman.

**Base URL:** `http://localhost:<PORT>/api` (replace `<PORT>` with your running port).

The flow has two steps:
1. **Upload an image** → get back an S3 URL.
2. **Post the content JSON** with that URL pasted inside `data`.

---

## 1. Upload an image

`POST /api/uploads/image`

In Postman:
1. Method **POST**, URL `http://localhost:<PORT>/api/uploads/image`
2. Go to the **Body** tab → select **form-data**.
3. Add these keys:

| Key      | Type | Value                          |
| -------- | ---- | ------------------------------ |
| `image`  | File | (click the dropdown on the key, choose **File**, then select your image) |
| `folder` | Text | `hero` (optional — defaults to `cms`) |

> Do **not** set a `Content-Type` header manually — Postman sets the multipart boundary
> automatically when you use form-data.

**Response:**
```json
{
  "message": "Image uploaded successfully",
  "data": { "url": "https://harmonic-time.s3.us-east-1.amazonaws.com/hero/..." }
}
```

Copy `data.url` — you'll paste it into the content payload below.

---

## 2. Create content

`POST /api/site-content`

In Postman:
1. Method **POST**, URL `http://localhost:<PORT>/api/site-content`
2. **Body** tab → select **raw** → choose **JSON** from the dropdown.
3. Paste one of the payloads below.

Common fields:
- `type` *(required, string)* — groups records, e.g. `hero_slider`, `category_banner`, `video_area`. Any new string works with no backend change.
- `data` *(required, object or array)* — the freeform content. **Its shape is never validated**, so it can differ per type and change anytime.
- `order` *(optional, number)* — display order (ascending).
- `isActive` *(optional, boolean)* — defaults to `true`.

### Example — Hero slider
```json
{
  "type": "hero_slider",
  "order": 1,
  "data": {
    "bgImg": "https://harmonic-time.s3.us-east-1.amazonaws.com/hero/e-01.webp",
    "sm_title": "Milky White",
    "meta": true,
    "title": "HMT Janata",
    "subtitle": "The Janata is HMT's most storied, emblematic and charming watch for good reason."
  }
}
```

### Example — Category banner
```json
{
  "type": "category_banner",
  "order": 1,
  "data": {
    "img": "https://harmonic-time.s3.us-east-1.amazonaws.com/cms/gautam.jpg",
    "parentTitle": "HMT GAUTAM",
    "children": ["Watch"],
    "smDesc": ""
  }
}
```

### Example — Video area
```json
{
  "type": "video_area",
  "order": 1,
  "data": {
    "bgImg": "https://harmonic-time.s3.us-east-1.amazonaws.com/cms/video-bg.jpg",
    "videoTitle": "Crafted by hand",
    "videoId": "dQw4w9WgXcQ",
    "description": "A short film on how each piece is assembled."
  }
}
```

**Response:**
```json
{
  "message": "Content created successfully",
  "data": {
    "_id": "665...",
    "type": "hero_slider",
    "data": { "...": "..." },
    "order": 1,
    "isActive": true,
    "createdAt": "2026-05-22T...",
    "updatedAt": "2026-05-22T..."
  }
}
```

---

## 3. Read content

`GET /api/site-content`

| URL                                         | Returns                                            |
| ------------------------------------------- | -------------------------------------------------- |
| `/api/site-content`                         | All content, every type (flat array, sorted by `order`) |
| `/api/site-content?type=hero_slider`        | Only that type                                     |
| `/api/site-content?isActive=true`           | Only active records                                |
| `/api/site-content?grouped=true`            | A map keyed by type: `{ "hero_slider": [...], "category_banner": [...] }` |
| `/api/site-content/:id`                     | A single record by id                              |

Query params can be combined, e.g. `/api/site-content?type=hero_slider&isActive=true`.

**Grouped response shape (`?grouped=true`):**
```json
{
  "message": "",
  "data": {
    "hero_slider": [ { "...": "..." } ],
    "category_banner": [ { "...": "..." } ],
    "video_area": [ { "...": "..." } ]
  }
}
```

---

## 4. Update content

`PUT /api/site-content/:id`

**Body** → **raw** → **JSON**. Send only the fields you want to change (at least one):
```json
{
  "data": {
    "bgImg": "https://harmonic-time.s3.us-east-1.amazonaws.com/hero/new.webp",
    "title": "HMT Janata (Updated)"
  },
  "order": 2,
  "isActive": false
}
```
> `data` is replaced wholesale (not deep-merged) — send the complete `data` object you want stored.

---

## 5. Delete content

`DELETE /api/site-content/:id`

No body required.

**Response:**
```json
{ "message": "Content deleted successfully", "data": null }
```

---

## Adding a brand-new block type later

No backend or new endpoint needed. Just upload any images, then `POST /api/site-content`
with a new `type` (e.g. `"promo_strip"`) and whatever `data` shape that block needs. Fetch
it on the frontend with `GET /api/site-content?type=promo_strip`.

---

# Contact Us — form submissions

Visitors submit the Contact Us form; the message is stored and (if `CONTACT_RECIPIENT`
/ `EMAIL_USER` is configured) emailed to you. Email failure never blocks the submission.

### Submit a message (public)
`POST /api/contact`

**Body** → **raw → JSON**:
```json
{
  "name": "Asha Rao",
  "email": "asha@example.com",
  "phone": "+91 98765 43210",
  "subject": "Question about HMT Janata",
  "message": "Is the Janata available with a steel strap?"
}
```
- `name`, `email`, `message` are **required** (`email` must be a valid address).
- `phone`, `subject` are optional.

**Response:**
```json
{
  "message": "Message sent successfully",
  "data": {
    "_id": "665...",
    "name": "Asha Rao",
    "email": "asha@example.com",
    "phone": "+91 98765 43210",
    "subject": "Question about HMT Janata",
    "message": "Is the Janata available with a steel strap?",
    "isRead": false,
    "createdAt": "2026-05-22T..."
  }
}
```

### View / manage submissions

| Method & URL                          | Purpose                                          |
| ------------------------------------- | ------------------------------------------------ |
| `GET /api/contact`                    | All submissions, newest first                    |
| `GET /api/contact?isRead=false`       | Only unread (`?isRead=true` for read)            |
| `GET /api/contact/:id`                | A single submission                              |
| `PATCH /api/contact/:id/read`         | Mark a submission as read (no body)              |
| `DELETE /api/contact/:id`             | Delete a submission                              |

> Email notifications go to the `CONTACT_RECIPIENT` env var (falls back to `EMAIL_USER`).
> Set it in `.env` to control where contact emails are delivered.
