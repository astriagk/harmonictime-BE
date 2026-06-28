# Auto-fill Product Listing from Photos

## Goal

When a seller lists a watch, let them **upload the photos first**, run those
photos through a vision model to auto-extract as many product attributes as
possible (brand, materials, movement, dial color, diameter, etc.), and pre-fill
the add-product form. The seller only fills in manually what the photos can't
determine.

Current state: the seller fills the entire 5-step form by hand; images are the
last step. There is no AI/vision integration anywhere yet.

---

## Architecture overview

```
Seller uploads photos (FE, step 1)
        │  click "Auto-fill from photos"
        ▼
POST /products/analyze-images   (multipart: images[])   ── BACKEND
        │  backend calls vision model (Claude / GPT-4o)
        │  model returns structured attributes
        ▼
{ data: { brand, caseMaterial, movement, ... } }
        │
        ▼
FE maps attribute names → catalog lookup IDs, patches the form,
shows "Detected / Complete manually" banner. Seller edits + submits
through the existing create flow (unchanged).
```

The vision/API key stays **server-side only**. The FE never talks to the model
directly.

---

## BACKEND — to be developed

### 1. New endpoint

`POST /products/analyze-images`
- **Auth:** seller bearer token (same as other seller endpoints).
- **Body:** `multipart/form-data`, field `images` repeated (2–5 image files,
  jpeg/png/jpg). These are for analysis only — **do not persist** anything; the
  existing `/upload/images` + `/product-images` flow still handles storage on
  final submit.
- **Behavior:** send the images to a vision model and return the extracted
  attributes as JSON.

### 2. Vision model

Recommended: **Claude vision with structured output (tool use / JSON schema)**.
- `claude-opus-4-8` for best accuracy, or `claude-sonnet-4-6` for a cheaper,
  faster balance (sufficient for this task).
- Alternative: OpenAI `gpt-4o`. The response contract below is
  provider-agnostic, so the model can be swapped without any FE change.
- Force JSON via tool use / response schema — do not parse free-form prose.

### 3. Match to the catalog (important)

The form stores attributes as **lookup IDs**, and the option lists are
backend-owned (`/brands`, `/case-materials`, `/movements`, `/dial-colors`,
`/strap-materials`, `/watch-markers`, `/recipients`, `/categories`,
`/collections`, `/delivery-options`).

To maximize match rate, the backend should **fetch its own catalog lists and
instruct the model to choose from them** — return the exact catalog name, and
ideally the `_id` too. If a value isn't in the catalog, return `null` (the
seller will add it via the existing "+ add new" modal).

### 4. Response shape

```jsonc
{
  "data": {
    "productName": "Submariner Date",
    "brand":        { "name": "Rolex", "id": "<catalogId|null>" },
    "caseMaterial": { "name": "Stainless Steel", "id": "..." },
    "strapMaterial":{ "name": "Stainless Steel", "id": "..." },
    "movement":     { "name": "Automatic", "id": "..." },
    "dialColor":    { "name": "Black", "id": "..." },
    "watchMarkers": { "name": "Baton", "id": "..." },
    "diameter": "41mm",
    "waterResistant": "Yes",            // one of: Yes | No | Both
    "guarantee": null,                  // one of: Yes | No | null
    "manufacturerProductNumber": "126610LN",
    "shortTitle": "Rolex Submariner Date",
    "detailedDescription": "…"
    // any field the model can't determine -> null or omitted
  }
}
```
- For lookup-backed fields, returning `{ name, id }` lets the FE prefer the `id`
  and fall back to name matching. Returning just a string is also acceptable.
- Free-text fields (`diameter`, `manufacturerProductNumber`, `productName`,
  descriptions) are plain strings.

### 5. Fields the backend should NOT try to infer
Price, GST-inclusive flag, quantity, collection, recipient, delivery option, and
delivery/returns policy are business decisions, not derivable from a photo.
Leave them out — the seller fills them manually.

### 6. Robustness
- Handle the model returning malformed/partial JSON gracefully (return whatever
  resolved, `null` the rest).
- Cap image count/size; reject non-image files.
- Reasonable timeout + clear error response so the FE can show a toast.

---

## FRONTEND — to be developed

All changes are in the seller add/edit product feature.

### 1. Endpoint constant — `src/app/config/index.ts`
Add near the uploads block:
```ts
export const ANALYZE_PRODUCT_IMAGES = `${baseUrl}/products/analyze-images`;
```

### 2. Service — reuse existing
`GenericService.postObservableImages(url, formData)`
(`src/app/shared/services/generic.service.ts`) already posts multipart
`FormData` with correct headers. No new service method required.

### 3. Component — `src/app/harmonic/seller/products/add-edit/add-edit.component.ts`

New state:
- `isAnalyzing = false`
- `analysisDone = false`
- `detectedFields: string[] = []`, `missingFields: string[] = []` (for the banner)
- getter `hasNewImages` → true when `uploadedImages` has at least one entry with a `file`

New `analyzeImages()`:
1. Guard: require ≥1 uploaded image with a `file`.
2. Build `FormData`, append each `img.file` under `images`.
3. `postObservableImages(ANALYZE_PRODUCT_IMAGES, formData)`,
   `takeUntil(this.destroy$)`, toggle `isAnalyzing` via `finalize`.
4. On success → `applyAnalysis(res.data)`. On error → toast.

New helper `matchLookupId(name, list, nameField): string | null` — case-insensitive,
trimmed exact match against the already-loaded arrays (`this.brands`,
`this.caseMaterials`, `this.movements`, `this.dialColors`, `this.strapMaterials`,
`this.watchMarkers`, `this.recipients`, `this.categories`, `this.collections`,
`this.deliveryOptions`, populated by `loadLookups()`). Prefer a backend-supplied
`id` when present.

New `applyAnalysis(data)`:
- Use **`patchValue`** (never `setValue`) and only patch a control when a value
  resolves — never overwrite something the seller already typed.
- **Lookup-ID fields:** iterate the existing `lookupConfigs` map (which already
  encodes field → form group → array → control wiring) to resolve and patch
  `brandId`, `caseMaterialId`, `movementId`, `dialColorId`, `strapMaterialId`,
  `watchMarkersId`, etc.
- **Enum selects:** `waterResistant` (Yes/No/Both) and `guarantee` (Yes/No) —
  patch only if the returned string matches an option id.
- **Free-text:** `productName`, `diameter`, `manufacturerProductNumber`,
  `shortTitle`, `detailedDescription` — patch directly (respect existing
  maxLength validators; truncate if needed).
- Record resolved controls into `detectedFields`; push the label of any
  expected-but-unresolved field into `missingFields`.
- `markAsDirty()` the patched groups so the edit-mode "send only dirty groups"
  logic persists auto-filled values; set `analysisDone = true`.

The submit/create/update flow is **unchanged** — auto-filled values flow through
`createProduct()` / `updateProduct()` like any manual entry.

### 4. Template — `add-edit.component.html`
- **Move the Media (image/video upload) step to be the FIRST `<mat-step>`.**
- In that step, add an **"✨ Auto-fill from photos"** button:
  `(click)="analyzeImages()"`, `[disabled]="isAnalyzing || !hasNewImages"`,
  with a spinner / "Analyzing…" state while `isAnalyzing`.
- Add a results banner (when `analysisDone`): "Detected: Brand, Case Material, …"
  and "Please complete manually: Diameter, Guarantee, …" from
  `detectedFields` / `missingFields`.
- Seller can edit any pre-filled value and still use the existing inline
  "+ add new lookup" modal for anything not in the catalog.

### 5. Linear-stepper gating — `add-edit.component.ts`
Stepper is linear (`isLinear = true`). With Media now first, ensure
`stepperNext()` lets the seller advance once `uploadedImages.length >= minImages`.
Auto-fill is **optional** — the seller can skip it and proceed manually. Keep the
existing `minImages`/`maxImages` and final `isFormValid()` checks.

### 6. Styles — `add-edit.component.scss`
Minor styling for the auto-fill button and the detected/missing banner. Follow
`spec/THEME.md` for colors/tokens.

---

## Verification (end-to-end)

1. Run the app, log in as a seller, open **Add Product**.
2. Until the real endpoint exists, stub `ANALYZE_PRODUCT_IMAGES` with a mock that
   returns a canned `data` object to validate the FE mapping/patch/banner UX.
3. Upload 2–5 photos on the new first step → click **Auto-fill from photos** →
   confirm spinner shows, then lookup dropdowns and text fields populate, the
   banner lists detected vs. missing, undetected fields stay empty/editable.
4. Edit an auto-filled value, complete required missing fields, submit → product
   is created with merged values.
5. Edit-mode regression: existing product prefill still works; re-running analyze
   patches without wiping untouched fields.
6. Catalog miss: a brand not in the catalog stays blank (seller uses "+ add new")
   with no console errors.

---

## Out of scope (stays manual by design)
Price, GST-inclusive flag, quantity, collection, recipient, delivery option,
delivery info, and returns policy — none are determinable from a photo.
