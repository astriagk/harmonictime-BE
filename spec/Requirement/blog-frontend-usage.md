# Blog API — Frontend Usage

The contract between `/api/blogs` and the Angular app. Both sides are built —
the endpoints are live and the frontend (service, admin CRUD screens, public
grid and detail) is already coded against them. This file records what each
side guarantees the other, so read it as the agreed shape rather than as
build instructions.

Base URL: `{API_BASE}/api/blogs` (same origin/base as every other module).

---

## 1. Response envelope — read this first

Every endpoint in this backend answers with the **same envelope**, not the
`{ success, data }` shape sketched in `blog-api.md`:

```json
{ "message": "Blogs retrieved successfully", "data": { ... } }
```

- Success and failure both use it — the **HTTP status code** is the signal.
- On error, `data` is `null` (or Joi validation details on a `400`).

So the payload always lives under `.data`:

```ts
this.http.get<ApiResponse<BlogListResponse>>(url).pipe(map(r => r.data));
```

```ts
export interface ApiResponse<T> {
  message: string;
  data: T;
}
```

---

## 2. Types

Field-for-field what the API returns. The app declares these in
`src/app/shared/types/blog-d-t.ts` under its own names — `IBlog`,
`IBlogListResponse`, `IBlogPayload` — so match on shape, not on the names used
here.

```ts
export interface IBlogCard {
  _id: string;
  Slug: string;
  Title: string;
  Excerpt: string;      // plain text, safe to interpolate
  Image: string;
  Author: string;
  Category: string;
  PublishedAt: string;  // ISO 8601 — format in the UI, never pre-formatted
}

export interface IBlogSeo {
  MetaTitle?: string;
  MetaDescription?: string;
}

// One block of the article. Render in array order: heading, then the HTML
// body, then the image with its caption underneath.
export interface IBlogSection {
  Heading?: string;  // plain text
  Content: string;   // sanitised HTML — no <img> ever appears here
  Image?: string;    // full-width, rendered under the copy
  Caption?: string;  // plain text
}

export interface IBlogDetail extends IBlogCard {
  Sections: IBlogSection[];    // article body, already in render order
  CategorySlug: string;
  Tags?: string[];
  Status: 'draft' | 'published' | 'archived';
  UpdatedAt: string;
  CreatedAt: string;
  Seo?: IBlogSeo;
}

export interface IBlogListResponse {
  items: IBlogCard[];
  total: number;   // total matching posts, NOT items.length — feed getPager()
  page: number;
  limit: number;
}

export interface IBlogCategory {
  Category: string;     // display label, e.g. "Buying Guides"
  CategorySlug: string; // e.g. "buying-guides"
  Count: number;
}
```

---

## 3. Public endpoints

### `GET /api/blogs` — grid list

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | 1-based |
| `limit` | number | `6` | Max `50` |
| `Category` | string | — | Accepts the label (`Buying Guides`) **or** the slug (`buying-guides`) |
| `Search` | string | — | Case-insensitive match on `Title` / `Excerpt` |

Returns `{ items, total, page, limit }`. Only published posts whose
`PublishedAt` has passed, newest first. Drafts and archived posts never appear.

### `GET /api/blogs/categories`

`IBlogCategory[]` for a category filter/sidebar. Counts published posts only.

### `GET /api/blogs/:slugOrId` — detail

Accepts the `Slug` (preferred) or the `_id`, so old `blog-details/:id` links
keep working alongside `blog-details/:slug`.

The bearer token is **optional** here: anonymous callers see published posts
only, an admin's token returns any post including drafts (see §6).

| Status | Meaning | UI |
|---|---|---|
| `200` | Post returned | Render |
| `404` | No such post — or a draft, to a non-admin | Not-found page |
| `410` | Post was archived | "This article has been removed" — do **not** show a generic 404 |

### `GET /api/blogs/:slugOrId/related`

Up to 3 `IBlogCard`s: same category first, topped up with the newest other
posts so the strip is never half-empty. `404` if the parent post isn't public.

---

## 4. Service

```ts
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly base = `${environment.apiUrl}/api/blogs`;

  constructor(private http: HttpClient) {}

  getBlogs(opts: { page?: number; limit?: number; category?: string; search?: string } = {})
    : Observable<IBlogListResponse> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('limit', String(opts.limit ?? 6));
    if (opts.category) params = params.set('Category', opts.category);
    if (opts.search)   params = params.set('Search', opts.search);

    return this.http
      .get<ApiResponse<IBlogListResponse>>(this.base, { params })
      .pipe(map(r => r.data));
  }

  getBlog(slugOrId: string): Observable<IBlogDetail> {
    return this.http
      .get<ApiResponse<IBlogDetail>>(`${this.base}/${slugOrId}`)
      .pipe(map(r => r.data));
  }

  getRelated(slugOrId: string): Observable<IBlogCard[]> {
    return this.http
      .get<ApiResponse<IBlogCard[]>>(`${this.base}/${slugOrId}/related`)
      .pipe(map(r => r.data));
  }

  getCategories(): Observable<IBlogCategory[]> {
    return this.http
      .get<ApiResponse<IBlogCategory[]>>(`${this.base}/categories`)
      .pipe(map(r => r.data));
  }
}
```

The shipped `blog.service.ts` follows this shape; the constants live in
`src/app/config/index.ts` as `BLOGS`, `BLOG_BY_ID`, `BLOGS_ADMIN`,
`BLOG_RELATED`. `UtilsService.blogs` / `filterBlogs()` / `getBlogById()`
(backed by the static `blog-data.ts`) are no longer part of the blog path.

---

## 5. What the frontend calls, and what the API guarantees back

| Piece | Location | Calls |
|---|---|---|
| Public grid | `shared/components/blogs/blog-area` → `blog-postbox-item` | `GET /api/blogs?page=&limit=` |
| Public detail | `/pages/blog-details/:slug` → `blog-dynamic-details` → `blog-details-area` | `GET /api/blogs/:slugOrId` (+ `/related`) |
| Admin list | `/admin/blogs` | `GET /api/blogs/admin/list` |
| Admin create/edit | `/admin/blogs/new`, `/admin/blogs/:id/edit` | `POST /api/blogs`, `PUT /api/blogs/:id` |
| Admin state | NgRx slice `adminBlogs` | — |

Guarantees the API side holds up, each matching a behaviour the built frontend
depends on:

1. **`:slugOrId` resolves either form.** The detail route passes its raw param
   straight through; a mongo id from an old link works exactly like a slug.
2. **Pagination is real, server-side.** `limit` is honoured (capped at 50) and
   `total` counts every match, not the page — so the grid's page links are
   correct. All the listing routes (`/pages/blog`, `blog-2-col`,
   `blog-left-sidebar`, `blog-no-sidebar`) can therefore share
   `BlogAreaComponent` at their own page sizes.
3. **Drafts and archived posts never appear in `GET /api/blogs`,** nor in
   `/categories` counts. The grid needs no status filter of its own.
4. **`Sections[]` order is the render order.** The array is stored and
   returned exactly as sent — never sorted, never merged. A `PUT` replaces the
   whole array, which is how a reorder is expressed.
5. **Every `Sections[].Content` is sanitised on write.** The frontend renders
   it with `bypassSecurityTrustHtml`, so this server-side pass is the only
   thing between an editor and stored XSS. What survives:
   - Tags: `p, h3, h4, strong, em, ul, ol, li, a, blockquote, br` — matching
     the editor's narrow toolbar. **`<img>` is stripped**: pictures belong in
     `Sections[].Image`, so one pasted into the body is removed rather than
     rendered out of place. `<h2>` is stripped too — the post `Title` owns
     that level, and section headings live in `Sections[].Heading`.
   - Quill's block classes — `ql-align-*`, `ql-indent-*`, `ql-direction-*` —
     survive on block elements, so alignment and indentation render as the
     author set them. **Every other class is dropped**, so authored content
     cannot reach into the site's stylesheet. Style the body under your own
     wrapper (e.g. `.blog-content`) plus the `ql-*` rules.
   - Removed: `<script>`, `<style>`, `<iframe>` and their contents, every
     `on*` handler, `javascript:`/`data:` URLs, and any tag outside the list
     (its text is kept). A `target="_blank"` link gains
     `rel="noopener noreferrer"`.
   - `Heading` and `Caption` are reduced to plain text, so both are safe to
     interpolate with `{{ }}`.
   - A section whose body sanitises to nothing is dropped from the array — a
     trailing blank block in the editor won't leave a gap in the article.
6. **Images are URLs, never file data.** The cover `Image` and every
   `Sections[].Image` are already S3 URLs by the time a post is saved — see
   §7.3. Base64 `data:` URIs are stripped, so the editor must upload pasted
   images rather than inline them.
7. **`Seo.MetaTitle` / `Seo.MetaDescription`** are stored verbatim (≤200 / ≤400
   chars) — `SeoService` does its own `| Krono²` suffixing and 160-char
   truncation, and the API never pre-formats.
8. **`410` is distinct from `404`.** Archived posts answer `410`; only a
   genuinely unknown slug or id gives `404`.
9. **The detail endpoint serves drafts to an admin.** `/admin/blogs/:id/edit`
   loads through the same `GET /api/blogs/:slugOrId` as the public page, so
   that endpoint takes an *optional* bearer token: with an admin's token it
   returns the post whatever its status, without one it applies the public
   rules above. A draft is therefore editable but invisible — an anonymous or
   non-admin request cannot even tell it exists (`404`, not `403`).

Rendering the body is a loop, not one `[innerHTML]`:

```html
<article class="blog-content">
  <section *ngFor="let s of post.Sections">
    <h3 *ngIf="s.Heading">{{ s.Heading }}</h3>
    <div [innerHTML]="s.Content"></div>
    <figure *ngIf="s.Image">
      <img [src]="s.Image" [alt]="s.Caption || post.Title" />
      <figcaption *ngIf="s.Caption">{{ s.Caption }}</figcaption>
    </figure>
  </section>
</article>
```

---

## 6. Admin endpoints

All require `Authorization: Bearer <token>` for a user holding the **admin**
role — same token as the rest of the admin panel. Non-admins get `403`.

| Method | Path | Body / params |
|---|---|---|
| `GET` | `/api/blogs/admin/list` | `page`, `limit`, `Category`, `Search`, `Status` (`draft`\|`published`\|`archived`). Includes drafts; items carry `Status`, `CreatedAt`, `UpdatedAt` |
| `GET` | `/api/blogs/:slugOrId` | Same endpoint the public detail page uses — **send the admin token** and it returns drafts and archived posts too, which is how the edit screen loads a post |
| `POST` | `/api/blogs` | Create — returns `201` + the full post |
| `PUT` | `/api/blogs/:id` | Update, all fields optional — returns the updated post |
| `DELETE` | `/api/blogs/:id` | Soft delete → `Status: 'archived'`. `?hard=true` removes the document |

**Create body**

```json
{
  "Title": "How To Spot A Fake Submariner",
  "Slug": "how-to-spot-a-fake-submariner",
  "Excerpt": "Five details that separate a genuine Submariner from a replica.",
  "Sections": [
    { "Content": "<p>The cyclops lens is the first tell...</p>" },
    {
      "Heading": "The dial",
      "Content": "<p>Printing on a genuine dial is razor sharp...</p>",
      "Image": "https://cdn.krono2.com/blog/submariner-dial.jpg",
      "Caption": "A genuine dial under 10x magnification"
    }
  ],
  "Image": "https://cdn.krono2.com/blog/submariner.jpg",
  "Author": "Gowtham K",
  "Category": "Buying Guides",
  "Tags": ["rolex", "authentication"],
  "Status": "published",
  "PublishedAt": "2026-08-01T09:00:00.000Z",
  "Seo": { "MetaTitle": "…", "MetaDescription": "…" }
}
```

Required: `Title`, `Excerpt`, `Sections`, `Image`, `Author`, `Category`.
Everything else is optional.

Behaviour worth knowing in the editor UI:

- **`Slug`** — omit it and one is generated from `Title`; collisions get `-2`,
  `-3`, … Renaming the `Title` later does **not** move the slug (live URLs stay
  put); send `Slug` explicitly to change it.
- **`Excerpt`** — HTML is stripped on write, so it is always plain text.
- **`Sections`** — at least one, and each body is sanitised on write. Send the
  array in render order; a `PUT` replaces it wholesale, so reordering or
  deleting a block means posting the full new array. Show the response after
  save so authors see what was actually kept.
- **`Status: 'published'`** with no `PublishedAt` stamps the current time. A
  **future** `PublishedAt` schedules the post — it stays out of the public list
  until that moment, no cron needed.
- **Images** — upload via the existing `/api/uploads` endpoint first, then send
  the returned URL. The blog endpoints take URLs, not files.

---

## 7. Sending a post from the frontend

The whole create flow, end to end: upload images → build the payload → POST.
This is what `blog-form.component` sends through the `adminBlogs` effects.

### 7.1 Field rules the form mirrors

Server-side Joi validation. Break one of these and you get a `400` before the
post is written, so the form enforces the same rules to avoid a round trip.

| Field | Required | Rule |
|---|---|---|
| `Title` | Yes | string, 3–200 chars |
| `Excerpt` | Yes | string, 10–400 chars. Plain text — markup is stripped on write |
| `Sections` | Yes | array, **min 1** entry (see below) |
| `Sections[].Heading` | No | string, max 200. Reduced to plain text |
| `Sections[].Content` | Yes | HTML string, min 10 chars |
| `Sections[].Image` | No | URL |
| `Sections[].Caption` | No | string, max 200. Reduced to plain text |
| `Image` | Yes | URL (absolute or relative) — the cover/hero |
| `Author` | Yes | string, max 120 |
| `Category` | Yes | string, max 120 |
| `Slug` | No | string, max 120. Generated from `Title` when omitted |
| `Tags` | No | string[], each max 50. Defaults to `[]` |
| `Status` | No | `draft` \| `published` \| `archived`. Defaults to `draft` |
| `PublishedAt` | No | ISO 8601 date string |
| `Seo` | No | `{ MetaTitle?: string (≤200), MetaDescription?: string (≤400) }` |

Unknown keys are rejected — send only the fields above. In particular do **not**
send `_id`, `CategorySlug`, `CreatedAt`, or `UpdatedAt`; the server owns those.
The old flat `Content` and `BannerImage` fields are gone: posting either now
fails with `"Content" is not allowed`.

### 7.2 Request types

```ts
export interface BlogSectionPayload {
  Heading?: string;
  Content: string;
  Image?: string;
  Caption?: string;
}

export interface CreateBlogRequest {
  Title: string;
  Excerpt: string;
  Sections: BlogSectionPayload[];  // min 1, in render order
  Image: string;
  Author: string;
  Category: string;
  Slug?: string;
  Tags?: string[];
  Status?: 'draft' | 'published' | 'archived';
  PublishedAt?: string | null;   // ISO 8601
  Seo?: { MetaTitle?: string; MetaDescription?: string };
}

// PUT accepts the same fields, all optional — send only what changed.
export type UpdateBlogRequest = Partial<CreateBlogRequest>;
```

### 7.3 Step 1 — upload the images, get URLs back

The blog endpoints take **URLs, not files**. Upload first via the existing
uploader, then put the returned `url` in the payload.

```ts
uploadImage(file: File): Observable<string> {
  const form = new FormData();
  form.append('image', file);          // field name must be "image"
  form.append('folder', 'blog');       // optional — groups under site-content/blog/
  return this.http
    .post<ApiResponse<{ url: string }>>(`${environment.apiUrl}/api/uploads/image`, form)
    .pipe(map(r => r.data.url));
}
```

Do **not** set `Content-Type` yourself — the browser adds the multipart
boundary. The same call fills both the cover `Image` and each
`Sections[].Image`; an `<img>` pasted into a section body is stripped, so a
picture only survives by being uploaded and assigned to its section.

### 7.4 Step 2 — the service methods

```ts
// On BlogService. Where an HttpInterceptor already attaches the bearer token,
// the `headers` argument is redundant.
private get authHeaders(): HttpHeaders {
  return new HttpHeaders({ Authorization: `Bearer ${this.auth.token}` });
}

createBlog(payload: CreateBlogRequest): Observable<IBlogDetail> {
  return this.http
    .post<ApiResponse<IBlogDetail>>(this.base, payload, { headers: this.authHeaders })
    .pipe(map(r => r.data));
}

updateBlog(id: string, payload: UpdateBlogRequest): Observable<IBlogDetail> {
  return this.http
    .put<ApiResponse<IBlogDetail>>(`${this.base}/${id}`, payload, { headers: this.authHeaders })
    .pipe(map(r => r.data));
}

// The edit screen loads through the public detail endpoint — the token is what
// makes a draft visible. Calling getBlog() without it 404s on an unpublished
// post.
getBlogForEdit(id: string): Observable<IBlogDetail> {
  return this.http
    .get<ApiResponse<IBlogDetail>>(`${this.base}/${id}`, { headers: this.authHeaders })
    .pipe(map(r => r.data));
}

archiveBlog(id: string): Observable<void> {
  return this.http
    .delete<ApiResponse<null>>(`${this.base}/${id}`, { headers: this.authHeaders })
    .pipe(map(() => void 0));
}

adminList(opts: { page?: number; limit?: number; status?: string; search?: string } = {})
  : Observable<IBlogListResponse> {
  let params = new HttpParams()
    .set('page', String(opts.page ?? 1))
    .set('limit', String(opts.limit ?? 10));
  if (opts.status) params = params.set('Status', opts.status);
  if (opts.search) params = params.set('Search', opts.search);

  return this.http
    .get<ApiResponse<IBlogListResponse>>(`${this.base}/admin/list`, {
      params, headers: this.authHeaders,
    })
    .pipe(map(r => r.data));
}
```

### 7.5 Step 3 — the editor form

The body is a `FormArray` of section groups — one Quill instance per section,
each with its own optional image and caption. The array's order *is* the
article's order, so a move-up/move-down control is just a `FormArray` swap.

```ts
form = this.fb.group({
  Title:       ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
  Slug:        [''],                                    // blank = auto-generate
  Excerpt:     ['', [Validators.required, Validators.minLength(10), Validators.maxLength(400)]],
  Sections:    this.fb.array([this.newSection()], Validators.required),
  Image:       ['', Validators.required],               // cover, filled by the uploader
  Author:      ['', Validators.required],
  Category:    ['', Validators.required],
  Tags:        [[] as string[]],
  Status:      ['draft'],
  PublishedAt: [null as string | null],                 // set only when scheduling
  MetaTitle:   [''],
  MetaDescription: [''],
});

newSection(): FormGroup {
  return this.fb.group({
    Heading: ['', Validators.maxLength(200)],
    Content: ['', [Validators.required, Validators.minLength(10)]],
    Image:   [''],                                      // filled by the uploader
    Caption: ['', Validators.maxLength(200)],
  });
}

get sections(): FormArray {
  return this.form.get('Sections') as FormArray;
}

addSection(): void { this.sections.push(this.newSection()); }
removeSection(i: number): void {
  if (this.sections.length > 1) this.sections.removeAt(i);  // min 1 server-side
}
moveSection(from: number, to: number): void {
  const group = this.sections.at(from);
  this.sections.removeAt(from);
  this.sections.insert(to, group);
}
```

Flatten the form value into the payload, dropping every empty optional so the
server applies its own defaults instead of storing blanks:

```ts
private toPayload(): CreateBlogRequest {
  const v = this.form.getRawValue();

  const payload: CreateBlogRequest = {
    Title: v.Title!.trim(),
    Excerpt: v.Excerpt!.trim(),
    // Order preserved exactly; empty optionals dropped per section.
    Sections: (v.Sections ?? []).map(s => ({
      Content: s.Content!,
      ...(s.Heading?.trim() ? { Heading: s.Heading.trim() } : {}),
      ...(s.Image?.trim()   ? { Image: s.Image.trim() }     : {}),
      ...(s.Caption?.trim() ? { Caption: s.Caption.trim() } : {}),
    })),
    Image: v.Image!,
    Author: v.Author!.trim(),
    Category: v.Category!.trim(),
    Status: v.Status as CreateBlogRequest['Status'],
  };

  if (v.Slug?.trim())        payload.Slug = v.Slug.trim();
  if (v.Tags?.length)        payload.Tags = v.Tags;
  // Only send a date when the author actually scheduled one — omitting it lets
  // "published" stamp now.
  if (v.PublishedAt)         payload.PublishedAt = new Date(v.PublishedAt).toISOString();
  if (v.MetaTitle || v.MetaDescription) {
    payload.Seo = {
      ...(v.MetaTitle ? { MetaTitle: v.MetaTitle } : {}),
      ...(v.MetaDescription ? { MetaDescription: v.MetaDescription } : {}),
    };
  }

  return payload;
}

save(): void {
  if (this.form.invalid) { this.form.markAllAsTouched(); return; }
  this.saving = true;

  const req$ = this.blogId
    ? this.blogService.updateBlog(this.blogId, this.toPayload())
    : this.blogService.createBlog(this.toPayload());

  req$.subscribe({
    next: post => {
      this.saving = false;
      this.blogId = post._id;
      // Sections come back sanitised, and a blank one may have been dropped —
      // rebuild the array so the editor shows exactly what was stored.
      this.sections.clear();
      post.Sections.forEach(s => this.sections.push(this.fb.group(s)));
      this.form.patchValue({ Slug: post.Slug });
      this.router.navigate(['/admin/blogs']);
    },
    error: (err: HttpErrorResponse) => {
      this.saving = false;
      this.errors = this.mapValidationErrors(err);
    },
  });
}
```

Two buttons, one payload — "Save draft" sends `Status: 'draft'`, "Publish"
sends `Status: 'published'`. To unpublish, `PUT` with `Status: 'draft'`.

### 7.6 Handling the `400`

Joi failures come back in the envelope's `data` as an array — map them onto the
form controls rather than showing one generic toast:

```json
{
  "message": "Validation error",
  "data": [
    { "message": "\"Excerpt\" length must be at least 10 characters long",
      "path": ["Excerpt"], "type": "string.min" }
  ]
}
```

A failure inside the body carries its index in `path`, e.g.
`["Sections", 1, "Content"]` — join the path so the message lands on the right
section rather than on the array as a whole:

```ts
private mapValidationErrors(err: HttpErrorResponse): Record<string, string> {
  if (err.status !== 400 || !Array.isArray(err.error?.data)) {
    return { _: err.error?.message ?? 'Something went wrong' };
  }
  return err.error.data.reduce((acc: Record<string, string>, d: any) => {
    acc[(d.path ?? []).join('.') || '_'] = d.message;   // "Sections.1.Content"
    return acc;
  }, {});
}
```

### 7.7 The same request as curl

Handy for testing the editor's payload without the UI:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"…"}' | jq -r .data.token)

curl -X POST http://localhost:5000/api/blogs \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "Title": "How To Spot A Fake Submariner",
    "Excerpt": "Five details that separate a genuine Submariner from a replica.",
    "Sections": [
      { "Content": "<p>The cyclops lens is the first tell.</p>" },
      { "Heading": "The dial",
        "Content": "<p>Printing on a genuine dial is razor sharp.</p>",
        "Image": "https://cdn.krono2.com/blog/submariner-dial.jpg",
        "Caption": "A genuine dial under 10x magnification" }
    ],
    "Image": "https://cdn.krono2.com/blog/submariner.jpg",
    "Author": "Gowtham K",
    "Category": "Buying Guides",
    "Tags": ["rolex", "authentication"],
    "Status": "published"
  }'
```

Response `201`:

```json
{
  "message": "Blog created successfully",
  "data": {
    "_id": "6a7e9c429f4367f114589d66",
    "Slug": "how-to-spot-a-fake-submariner",
    "Title": "How To Spot A Fake Submariner",
    "Excerpt": "Five details that separate a genuine Submariner from a replica.",
    "Sections": [
      { "Content": "<p>The cyclops lens is the first tell.</p>" },
      {
        "Heading": "The dial",
        "Content": "<p>Printing on a genuine dial is razor sharp.</p>",
        "Image": "https://cdn.krono2.com/blog/submariner-dial.jpg",
        "Caption": "A genuine dial under 10x magnification"
      }
    ],
    "Image": "https://cdn.krono2.com/blog/submariner.jpg",
    "Author": "Gowtham K",
    "Category": "Buying Guides",
    "CategorySlug": "buying-guides",
    "Tags": ["rolex", "authentication"],
    "Status": "published",
    "PublishedAt": "2026-08-14T04:40:34.905Z",
    "CreatedAt": "2026-08-14T04:40:34.905Z",
    "UpdatedAt": "2026-08-14T04:40:34.905Z"
  }
}
```

Note what changed on the way in: `Slug` was generated, `CategorySlug` derived,
`PublishedAt` stamped, section order kept — and had a section body contained a
`<script>`, an `onclick` or an `<img>`, it would be gone from this response.

---

## 8. Status codes

| Code | When |
|---|---|
| `200` | OK |
| `201` | Post created |
| `400` | Validation failed (`data` holds Joi details) or malformed `:id` |
| `401` | Missing/invalid token on an admin endpoint |
| `403` | Authenticated but not an admin |
| `404` | No published post matches the slug/id |
| `410` | Post exists but is archived |

---

## 9. Storage

Collection `Blogs` — schema documented in
[harmoniv_time_v2.dbml](../database/V2/harmoniv_time_v2.dbml) (`Content` table
group). `Sections[]` is stored as an embedded array, so a post is a single
document and the detail endpoint is a single read. Indexes are created at
startup: unique `Slug`, plus `(Status, PublishedAt)` and
`(CategorySlug, Status, PublishedAt)` for the list queries.

Posts written before the `Sections[]` change kept the body in a flat `Content`
string. `npm run migrate:blog-sections` folds each one into a single section,
hoisting the first inline `<img>` into that section's `Image`, then removes the
old `Content` and `BannerImage` fields. It is idempotent and has already been
run against this database.
