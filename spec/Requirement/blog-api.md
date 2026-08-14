# Blog API

> **Superseded by [blog-frontend-usage.md](blog-frontend-usage.md).** That file
> documents the endpoints as actually built, and the frontend is coded against
> it. Three differences matter: the response envelope is `{ message, data }` (not
> `{ success, data }` as sketched below), `DELETE` soft-archives a post, which
> then answers `410`, and the article body is now an ordered `Sections[]` array
> rather than a single `Content` HTML string. Treat this file as the original
> proposal only.

Blog posts shown on the public 3-column blog grid (`/pages/blog-3-col`) and the
blog detail page (`/pages/blog-details/:id`).

Base path: `/api/blogs`

Frontend consumers:
- Grid — `BlogAreaComponent` → `BlogPostboxItemComponent`
- Detail — `BlogDynamicDetailsComponent` → `BlogDetailsAreaComponent`

---

## Endpoints

### GET `/api/blogs`
Paginated list of published posts. Powers the 3-column grid (6 cards per page).

**Query params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `page` | number | No | 1-based. Default `1` |
| `limit` | number | No | Default `6` (the 3-col page shows 6) |
| `Category` | string | No | Filter by category slug |
| `Search` | string | No | Match against title / excerpt |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664f1a2b3c4d5e6f7a8b9c0d",
        "Slug": "how-to-spot-a-fake-submariner",
        "Title": "How To Spot A Fake Submariner",
        "Excerpt": "Five details that separate a genuine Rolex Submariner from a convincing replica.",
        "Image": "https://cdn.krono2.com/blog/submariner-guide.jpg",
        "Author": "Gowtham K",
        "Category": "Buying Guides",
        "PublishedAt": "2026-08-01T09:00:00.000Z"
      }
    ],
    "total": 24,
    "page": 1,
    "limit": 6
  }
}
```

**Card fields — all required**

Every one of these is rendered by the grid card; a missing value leaves a visible hole.

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Fallback route param if `Slug` is absent |
| `Slug` | string | Preferred URL segment — SEO-friendly, unique |
| `Title` | string | Card heading + link text |
| `Excerpt` | string | Short teaser, ~150–200 chars. **Plain text, no HTML** |
| `Image` | string | Absolute URL. Card thumbnail, landscape ~370×250 |
| `Author` | string | Display name only |
| `Category` | string | Not rendered on the card yet; used for filtering |
| `PublishedAt` | string | ISO 8601. The UI formats it — do not pre-format |

---

### GET `/api/blogs/:slugOrId`
Full post for the detail page. Accepts either the `Slug` or the `_id`.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "_id": "664f1a2b3c4d5e6f7a8b9c0d",
    "Slug": "how-to-spot-a-fake-submariner",
    "Title": "How To Spot A Fake Submariner",
    "Excerpt": "Five details that separate a genuine Rolex Submariner from a convincing replica.",
    "Image": "https://cdn.krono2.com/blog/submariner-guide.jpg",
    "Sections": [
      {
        "Content": "<p>The cyclops lens is the first tell...</p>"
      },
      {
        "Heading": "The dial",
        "Content": "<p>Printing on a genuine dial is razor sharp...</p>",
        "Image": "https://cdn.krono2.com/blog/submariner-dial.jpg",
        "Caption": "A genuine dial under 10x magnification"
      }
    ],
    "Author": "Gowtham K",
    "Category": "Buying Guides",
    "Tags": ["rolex", "authentication"],
    "PublishedAt": "2026-08-01T09:00:00.000Z",
    "UpdatedAt": "2026-08-03T11:20:00.000Z",
    "Seo": {
      "MetaTitle": "How To Spot A Fake Rolex Submariner | Krono2",
      "MetaDescription": "Five details that separate a genuine Submariner from a replica."
    }
  }
}
```

**Detail-only fields**

| Field | Type | Required | Notes |
|---|---|---|---|
| `Sections` | object[] | **Yes** | The article body, in render order. Min 1 entry — see below |
| `Tags` | string[] | No | For a tag list in the sidebar / footer |
| `UpdatedAt` | string | No | ISO 8601 |
| `Seo` | object | No | Feeds the route's SEO meta tags |

**`Sections[]` entry**

| Field | Type | Required | Notes |
|---|---|---|---|
| `Heading` | string | No | Sub-heading rendered above the text. Max 200 |
| `Content` | string | **Yes** | Sanitised HTML, min 10 chars. **Text only — no `<img>`** |
| `Image` | string | No | Absolute URL, rendered full width *under* the text |
| `Caption` | string | No | Caption under the image. Max 200 |

> **Array order is the render order.** Persist and return it unchanged.

> **Every `Sections[].Content` must be sanitised server-side.** The frontend
> renders it with `[innerHTML]`, which strips `<script>` but not every injection
> vector. Allow only: `p, h3, h4, strong, em, ul, ol, li, a, blockquote, br`.
> **Strip `<img>`** — images belong in `Sections[].Image`, which is what keeps a
> picture next to the copy it illustrates.

**Errors**
| Status | Reason |
|---|---|
| `404` | No published post matches the slug or id |

---

### GET `/api/blogs/:slugOrId/related`
Optional. Related posts strip at the bottom of the detail page.
Returns the same card shape as the list endpoint's `items`, capped at 3.

---

## Admin endpoints

Create / edit posts. Require an authenticated admin.

### POST `/api/blogs`
| Field | Type | Required | Notes |
|---|---|---|---|
| `Title` | string | Yes | |
| `Slug` | string | No | Auto-generated from `Title` if omitted; must stay unique |
| `Excerpt` | string | Yes | |
| `Sections` | object[] | Yes | Min 1. `{ Heading?, Content, Image?, Caption? }` — order preserved |
| `Image` | string | Yes | Cover image: the grid thumbnail and the article hero |
| `Author` | string | Yes | |
| `Category` | string | Yes | |
| `Tags` | string[] | No | |
| `Status` | string | No | `draft` \| `published`. Default `draft` |
| `PublishedAt` | string | No | Defaults to publish time |
| `Seo` | object | No | `MetaTitle`, `MetaDescription` |

**Response `201`** — the created post, same shape as the detail endpoint.

### PUT `/api/blogs/:id`
Same body as POST, all fields optional. Returns the updated post.

### DELETE `/api/blogs/:id`
Soft-delete preferred (set `Status: 'archived'`) so existing URLs can 410
rather than 404.

### GET `/api/blogs/admin/list`
Admin listing — includes drafts. Same params as the public list plus
`Status`.

---

## Frontend status

The frontend is **built and waiting on these endpoints**. Nothing below needs
doing — it is recorded so backend work knows exactly what is calling it.

| Piece | Location |
|---|---|
| Endpoint constants | `src/app/config/index.ts` — `BLOGS`, `BLOG_BY_ID`, `BLOGS_ADMIN`, `BLOG_RELATED` |
| Types | `src/app/shared/types/blog-d-t.ts` — `IBlog`, `IBlogListResponse`, `IBlogPayload` |
| Service | `src/app/shared/services/blog.service.ts` |
| Admin list | `/admin/blogs` — `harmonic/admin/blogs/blogs.component.*` |
| Admin create/edit | `/admin/blogs/new`, `/admin/blogs/:id/edit` — `blog-form.component.*` |
| Admin state | NgRx slice `adminBlogs` (`store/{actions,reducers,effects,selectors}/admin-blogs.*`) |
| Public grid | `shared/components/blogs/blog-area` → `blog-postbox-item` |
| Public detail | `/pages/blog-details/:slug` → `blog-dynamic-details` → `blog-details-area` |

Behaviours the backend must match:

1. **Public detail route is `/pages/blog-details/:slug`** and passes the raw
   param to `GET /api/blogs/:slugOrId`. It must resolve a slug *or* a mongo id,
   since older links carry ids.
2. **The grid relies on real server pagination.** It sends `?page=&limit=` and
   builds its page links from `total` — a response that ignores `limit` will
   render the wrong number of page buttons.
3. **Drafts must never appear in `GET /api/blogs`.** The public grid applies no
   status filter of its own.
4. **Images are uploaded separately**, via the existing `POST /api/uploads/image`
   (field name `image`, returns `{ url }`). Both `Image` and every
   `Sections[].Image` are already S3 URLs by the time a post is saved — the blog
   endpoints never receive file data or base64.
5. **`Sections[].Content` arrives as HTML from Quill.** The editor's toolbar is
   deliberately narrow, so expect only `<p> <h3> <h4> <strong> <em> <ul> <ol>
   <li> <a> <blockquote>`. There is no image button — the toolbar cannot produce
   an `<img>`, and one arriving anyway should be stripped. The server-side
   sanitisation described above is the only thing standing between an editor and
   stored XSS.
6. **`Seo.MetaTitle` / `Seo.MetaDescription`** feed `SeoService`, which appends
   `| Krono²` to the title and truncates the description at 160 chars.

The other listing routes (`/pages/blog`, `/pages/blog-2-col`,
`/pages/blog-left-sidebar`, `/pages/blog-no-sidebar`) share `BlogAreaComponent`
and so are API-backed too, at their own page sizes.

Still on the static fixtures in `shared/data/blog-data.ts`: `home-seven` and
`blog-slider` / `blog-item` — orphan template pages with no inbound links. The
bare `/pages/blog-details` demo route (which rendered `blogs[0]`) was removed;
nothing linked to it.
