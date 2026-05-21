/**
 * Seeds all catalog reference data into MongoDB: Brands, Categories, Collections,
 * Recipients, Dial Colors, Movements, Strap Materials, Case Materials, Watch
 * Markers, Delivery Options, and sample Offers.
 *
 * Idempotent: existing names are skipped, so it is safe to re-run after editing
 * `src/scripts/data/referenceData.ts`. Respects the Collection → Brand FK by
 * resolving each brand name to its _id before inserting collections.
 *
 * Run:  npm run seed:reference
 */
import { Db, ObjectId } from "mongodb";
import { connectDB } from "../shared/config/database";
import { COLLECTIONS } from "../shared/constants/collections";
import {
  brands,
  categories,
  collectionsByBrand,
  recipients,
  dialColors,
  movements,
  strapMaterials,
  caseMaterials,
  watchMarkers,
  deliveryOptions,
  offers,
} from "./data/referenceData";

/**
 * Insert any `names` not already present in `collectionName`, storing each under
 * the document field `field`. Returns counts for logging.
 */
async function seedNameLookup(
  db: Db,
  label: string,
  collectionName: string,
  field: string,
  names: string[],
) {
  const col = db.collection(collectionName);
  const existing = await col.find({}, { projection: { [field]: 1 } }).toArray();
  const existingNames = new Set(existing.map((d: any) => d[field]));
  const docs = names
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ _id: new ObjectId(), [field]: name }));
  if (docs.length) await col.insertMany(docs);
  console.log(
    `${label}: +${docs.length} inserted, ${existingNames.size} already present.`,
  );
}

async function seed() {
  const db = await connectDB();

  // ── Brands ──────────────────────────────────────────────────────
  const brandCol = db.collection(COLLECTIONS.BRANDS);
  const existingBrands = await brandCol
    .find({}, { projection: { BrandName: 1 } })
    .toArray();
  const existingBrandNames = new Set(
    existingBrands.map((b: any) => b.BrandName),
  );
  const newBrands = brands
    .filter((name) => !existingBrandNames.has(name))
    .map((BrandName) => ({ _id: new ObjectId(), BrandName }));
  if (newBrands.length) await brandCol.insertMany(newBrands);
  console.log(
    `Brands: +${newBrands.length} inserted, ${existingBrandNames.size} already present.`,
  );

  // ── Categories ──────────────────────────────────────────────────
  const categoryCol = db.collection(COLLECTIONS.CATEGORIES);
  const existingCats = await categoryCol
    .find({}, { projection: { CategoryName: 1 } })
    .toArray();
  const existingCatNames = new Set(
    existingCats.map((c: any) => c.CategoryName),
  );
  const newCats = categories
    .filter((name) => !existingCatNames.has(name))
    .map((CategoryName) => ({ _id: new ObjectId(), CategoryName }));
  if (newCats.length) await categoryCol.insertMany(newCats);
  console.log(
    `Categories: +${newCats.length} inserted, ${existingCatNames.size} already present.`,
  );

  // ── Collections (resolve BrandID first) ─────────────────────────
  const brandIdByName = new Map<string, ObjectId>(
    (await brandCol.find({}, { projection: { BrandName: 1 } }).toArray()).map(
      (b: any) => [b.BrandName, b._id as ObjectId],
    ),
  );
  const collectionCol = db.collection(COLLECTIONS.COLLECTIONS);
  const existingColNames = new Set(
    (
      await collectionCol
        .find({}, { projection: { CollectionName: 1 } })
        .toArray()
    ).map((c: any) => c.CollectionName),
  );

  const toInsert: {
    _id: ObjectId;
    BrandID: ObjectId;
    CollectionName: string;
  }[] = [];
  let skippedNoBrand = 0;
  for (const [brandName, names] of Object.entries(collectionsByBrand)) {
    const brandId = brandIdByName.get(brandName);
    if (!brandId) {
      console.warn(
        `  ! Brand not found, skipping its collections: "${brandName}"`,
      );
      skippedNoBrand += names.length;
      continue;
    }
    for (const CollectionName of names) {
      if (existingColNames.has(CollectionName)) continue; // CollectionName is globally unique
      existingColNames.add(CollectionName);
      toInsert.push({ _id: new ObjectId(), BrandID: brandId, CollectionName });
    }
  }
  if (toInsert.length) await collectionCol.insertMany(toInsert);
  console.log(
    `Collections: +${toInsert.length} inserted` +
      (skippedNoBrand ? `, ${skippedNoBrand} skipped (brand missing)` : "") +
      ".",
  );

  // ── Simple name lookups ─────────────────────────────────────────
  await seedNameLookup(
    db,
    "Recipients",
    COLLECTIONS.RECIPIENTS,
    "RecipientName",
    recipients,
  );
  await seedNameLookup(
    db,
    "Dial colors",
    COLLECTIONS.DIAL_COLORS,
    "DialColorName",
    dialColors,
  );
  await seedNameLookup(
    db,
    "Movements",
    COLLECTIONS.MOVEMENTS,
    "MovementName",
    movements,
  );
  await seedNameLookup(
    db,
    "Strap materials",
    COLLECTIONS.STRAP_MATERIALS,
    "StrapMaterialName",
    strapMaterials,
  );
  await seedNameLookup(
    db,
    "Case materials",
    COLLECTIONS.CASE_MATERIALS,
    "CaseMaterialName",
    caseMaterials,
  );
  await seedNameLookup(
    db,
    "Watch markers",
    COLLECTIONS.WATCH_MARKERS,
    "WatchMarkerName",
    watchMarkers,
  );
  await seedNameLookup(
    db,
    "Delivery options",
    COLLECTIONS.DELIVERY_OPTIONS,
    "DeliveryOptionName",
    deliveryOptions,
  );

  // ── Offers (time-bound; stamp StartDate = now, EndDate = now + durationDays) ──
  const offerCol = db.collection(COLLECTIONS.OFFERS);
  const existingOfferNames = new Set(
    (await offerCol.find({}, { projection: { OfferName: 1 } }).toArray()).map(
      (o: any) => o.OfferName,
    ),
  );
  const now = new Date();
  const offerDocs = offers
    .filter((o) => !existingOfferNames.has(o.OfferName))
    .map((o) => ({
      _id: new ObjectId(),
      OfferName: o.OfferName,
      Description: o.Description,
      DiscountPercentage: o.DiscountPercentage,
      StartDate: now,
      EndDate: new Date(now.getTime() + o.durationDays * 24 * 60 * 60 * 1000),
      IsActive: o.IsActive,
    }));
  if (offerDocs.length) await offerCol.insertMany(offerDocs);
  console.log(
    `Offers: +${offerDocs.length} inserted, ${existingOfferNames.size} already present.`,
  );

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
