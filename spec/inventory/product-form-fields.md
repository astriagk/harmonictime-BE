# Product Listing — Form Fields to Fill

Everything you have to enter to list one watch, in the order the form asks for it. No API here —
this is the data-entry checklist. (For the endpoint-level version see
[product-creation.md](spec/inventory/product-creation.md).)

**Legend:** ⭐ = must be filled, or the listing can't be saved.

---

## Section 1 — Basic details

| # | Field | ⭐ | Input type | Example | Notes |
|---|-------|---|------------|---------|-------|
| 1 | Product name | ⭐ | Text | `Omega Seamaster Diver 300M` | The title buyers see. Brand + model + key spec reads best. Keep it under **120 chars**. |
| 2 | Brand | ⭐ | Dropdown | `Omega` | Pick from the brand list. |
| 3 | Collection |  | Dropdown | `Seamaster` | Only collections belonging to the brand you picked above are valid. |
| 4 | Category | ⭐ | Dropdown | `Diver` | |
| 5 | Recipient |  | Dropdown | `Men` | Who it's for — Men / Women / Unisex etc. |

## Section 2 — Price & stock

| # | Field | ⭐ | Input type | Example | Notes |
|---|-------|---|------------|---------|-------|
| 6 | Price (₹) | ⭐ | Number | `485000` | Plain number, no commas or ₹ symbol. |
| 7 | Price includes 18% GST? | ⭐ | Yes / No toggle | `Yes` | **Must be answered — there is no default.** Yes = the price above already has GST in it. No = GST is added on top. |
| 8 | Quantity | ⭐ | Number, minimum 1 | `1` | Total units you have of this exact listing. For a single pre-owned watch, enter 1. |
| 9 | Offer |  | Dropdown | `Festive 10% off` | Attach a promotional offer if you're running one. Can be added later. |

## Section 3 — Photos & video

| # | Field | ⭐ | Input type | Notes |
|---|-------|---|------------|-------|
| 10 | Images / video | ⭐ in practice | File upload | Up to **10 files per upload**, max **200 MB each**. Images and videos both allowed. |
| 11 | Primary image | ⭐ if you upload | Pick one | The thumbnail shown in search and listings. Exactly one. |
| 12 | Alt text |  | Text | Short description of the photo, e.g. `Omega Seamaster, blue dial, front view`. Helps accessibility and search. |

Suggested shots: front / dial, back / caseback, side profile, clasp, bracelet or strap, box &
papers, and close-ups of any wear or damage.

## Section 4 — Watch specifications

All optional, but this is what fills the spec table on the product page — an empty table looks
like an incomplete listing. Fill in whatever you know.

| # | Field | Input type | Example |
|---|-------|-----------|---------|
| 13 | Dial colour | Dropdown | `Blue` |
| 14 | Movement | Dropdown | `Automatic` |
| 15 | Strap material | Dropdown | `Stainless Steel` |
| 16 | Case material | Dropdown | `Stainless Steel` |
| 17 | Watch markers | Dropdown | `Index` |
| 18 | Delivery option | Dropdown | `Standard Delivery` |
| 19 | Diameter | Text | `42mm` |
| 20 | Water resistance | Text | `300m / 30 ATM` |
| 21 | Manufacturer product number | Text | `210.30.42.20.03.001` — the model / reference number |
| 22 | Guarantee | Text | `2 years international warranty` |

## Section 5 — Description

| # | Field | Input type | Length | Notes |
|---|-------|-----------|--------|-------|
| 23 | Description title | Text | up to **100 chars** | Optional heading above the description. |
| 24 | Description | Long text | **150–2,000 chars** | The main write-up: what it is, why it's desirable, how it wears. Aim for 400–800. |
| 25 | Additional details | Long text | up to **1,000 chars** | Condition, box & papers, service history, accessories, any flaws. |

## Section 6 — Delivery & returns

| # | Field | Input type | Length | Notes |
|---|-------|-----------|--------|-------|
| 26 | Delivery information | Long text | up to **1,000 chars** | Dispatch time, courier, packaging, insurance. |
| 27 | Returns policy | Long text | up to **1,000 chars** | Return window and conditions. |

> ⚠️ **These limits are a writing guideline, not a rule the server enforces yet.** The validation
> schemas currently accept any length for all text fields. The only hard ceiling is the ~100 KB
> request body cap from `express.json()`, which no realistic description will hit. Treat the
> numbers above as the target for the form's character counter — and if they should be enforced,
> they need `.max()` added to the Joi schemas.

---

## Filled automatically — don't look for these on the form

- Date listed
- Availability (starts as available)
- Approval status (starts as **Pending**)
- Approval note / approved by / approved on — set by the admin when they review it
- Units sold — counted from paid orders, never entered by hand

---

## Before the form will let you save

- The account must be an **approved seller**.
- If your total sales have crossed **₹2,00,000**, your **GST details must already be saved** on
  your profile — otherwise saving a new listing is blocked with a message telling you to add them.

## After you save

The listing goes in as **Pending** and is **not visible to buyers** until an admin approves it.
If it's rejected you'll see the admin's reason, and you can edit and resubmit.

Everything on this form can be edited later, and quantity can be set to **0** on edit (it must be
at least 1 when first creating).

---

## Quick copy-paste checklist

```
⭐ Product name:
⭐ Brand:
   Collection:
⭐ Category:
   Recipient:
⭐ Price (₹):
⭐ Price includes 18% GST? (Yes/No):
⭐ Quantity:
   Offer:
⭐ Photos uploaded (mark 1 primary):
   Alt text:
   Dial colour:
   Movement:
   Strap material:
   Case material:
   Watch markers:
   Delivery option:
   Diameter:
   Water resistance:
   Manufacturer product number:
   Guarantee:
   Description title:            (≤100 chars)
   Description:                  (150–2000 chars)
   Additional details:           (≤1000 chars)
   Delivery information:         (≤1000 chars)
   Returns policy:               (≤1000 chars)
```
