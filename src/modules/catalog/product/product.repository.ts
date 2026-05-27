import { Document, Filter, ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { Product } from "./product.types";

// Joins Products to its description / details / images / delivery + every
// lookup table. All foreign keys are stored as ObjectId (the corrected design),
// so plain localField/foreignField $lookups are enough — no $toObjectId needed.
const enrichmentStages = (): Document[] => [
  { $lookup: { from: COLLECTIONS.PRODUCT_DESCRIPTION, localField: "_id", foreignField: "ProductID", as: "Description" } },
  { $lookup: { from: COLLECTIONS.PRODUCT_DETAILS, localField: "_id", foreignField: "ProductID", as: "Details" } },
  { $unwind: { path: "$Details", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: COLLECTIONS.PRODUCT_IMAGES, localField: "_id", foreignField: "ProductID", as: "Images" } },
  { $lookup: { from: COLLECTIONS.DELIVERY_RETURNS, localField: "_id", foreignField: "ProductID", as: "DeliveryAndReturns" } },
  { $unwind: { path: "$DeliveryAndReturns", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: COLLECTIONS.BRANDS, localField: "BrandID", foreignField: "_id", as: "Brand" } },
  { $lookup: { from: COLLECTIONS.COLLECTIONS, localField: "CollectionID", foreignField: "_id", as: "Collection" } },
  { $lookup: { from: COLLECTIONS.CATEGORIES, localField: "CategoryID", foreignField: "_id", as: "Category" } },
  { $lookup: { from: COLLECTIONS.RECIPIENTS, localField: "RecipientID", foreignField: "_id", as: "Recipient" } },
  { $lookup: { from: COLLECTIONS.DIAL_COLORS, localField: "Details.DialColorID", foreignField: "_id", as: "DialColor" } },
  { $lookup: { from: COLLECTIONS.MOVEMENTS, localField: "Details.MovementID", foreignField: "_id", as: "Movement" } },
  { $lookup: { from: COLLECTIONS.STRAP_MATERIALS, localField: "Details.StrapMaterialID", foreignField: "_id", as: "StrapMaterial" } },
  { $lookup: { from: COLLECTIONS.CASE_MATERIALS, localField: "Details.CaseMaterialID", foreignField: "_id", as: "CaseMaterial" } },
  { $lookup: { from: COLLECTIONS.WATCH_MARKERS, localField: "Details.WatchMarkersID", foreignField: "_id", as: "WatchMarkers" } },
  { $lookup: { from: COLLECTIONS.DELIVERY_OPTIONS, localField: "Details.DeliveryOptionID", foreignField: "_id", as: "DeliveryOption" } },
  { $lookup: { from: COLLECTIONS.OFFERS, localField: "OfferID", foreignField: "_id", as: "Offer" } },
  { $unwind: { path: "$Offer", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Description", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Brand", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Collection", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Category", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Recipient", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$DialColor", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$Movement", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$StrapMaterial", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$CaseMaterial", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$WatchMarkers", preserveNullAndEmptyArrays: true } },
  { $unwind: { path: "$DeliveryOption", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 1,
      UserID: 1,
      ProductName: 1,
      Price: 1,
      DisplayPrice: {
        $add: [
          "$Price",
          { $round: [{ $multiply: ["$Price", env.BUYER_COMMISSION_RATE] }, 0] },
        ],
      },
      // Existing products predate the Quantity field; treat them as single-unit.
      Quantity: { $ifNull: ["$Quantity", 1] },
      OfferID: 1,
      // Only surface the offer when it is active AND the current time falls
      // within [StartDate, EndDate]. Expired or disabled offers are stripped
      // so callers never need to apply this logic themselves.
      Offer: {
        $cond: {
          if: {
            $and: [
              { $ifNull: ["$Offer._id", false] },
              { $eq: ["$Offer.IsActive", true] },
              { $lte: ["$Offer.StartDate", new Date()] },
              { $gte: ["$Offer.EndDate", new Date()] },
            ],
          },
          then: {
            _id: "$Offer._id",
            OfferName: "$Offer.OfferName",
            Description: "$Offer.Description",
            DiscountPercentage: "$Offer.DiscountPercentage",
            StartDate: "$Offer.StartDate",
            EndDate: "$Offer.EndDate",
            IsActive: "$Offer.IsActive",
          },
          else: "$$REMOVE",
        },
      },
      IsAvailable: 1,
      IsPriceInclusiveOfTax: 1,
      ApprovalStatus: { $ifNull: ["$ApprovalStatus", "Approved"] },
      ApprovalNote: 1,
      DateListed: 1,
      Description: {
        _id: "$Description._id",
        Title: "$Description.Title",
        Content: "$Description.Content",
        AdditionalDetails: "$Description.AdditionalDetails",
        CreatedAt: "$Description.CreatedAt",
      },
      Details: {
        _id: "$Details._id",
        Diameter: "$Details.Diameter",
        WaterResistant: "$Details.WaterResistant",
        ManufacturerProductNumber: "$Details.ManufacturerProductNumber",
        Guarantee: "$Details.Guarantee",
        BrandName: "$Brand.BrandName",
        BrandId: "$BrandID",
        CollectionName: "$Collection.CollectionName",
        CollectionId: "$CollectionID",
        CategoryName: "$Category.CategoryName",
        CategoryId: "$CategoryID",
        RecipientName: "$Recipient.RecipientName",
        RecipientId: "$RecipientID",
        DialColorName: "$DialColor.DialColorName",
        DialColorId: "$Details.DialColorID",
        MovementName: "$Movement.MovementName",
        MovementId: "$Details.MovementID",
        StrapMaterialName: "$StrapMaterial.StrapMaterialName",
        StrapMaterialId: "$Details.StrapMaterialID",
        CaseMaterialName: "$CaseMaterial.CaseMaterialName",
        CaseMaterialId: "$Details.CaseMaterialID",
        WatchMarkerName: "$WatchMarkers.WatchMarkerName",
        WatchMarkerId: "$Details.WatchMarkersID",
        DeliveryOptionName: "$DeliveryOption.DeliveryOptionName",
        DeliveryOptionID: "$Details.DeliveryOptionID",
      },
      Images: 1,
      DeliveryAndReturns: 1,
    },
  },
];

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(COLLECTIONS.PRODUCTS);
  }

  getEnriched(match: Filter<Product>) {
    return this.aggregate([{ $match: match }, ...enrichmentStages()]);
  }

  // Enriched products plus derived stock figures and Status. The same _id backs
  // every unit of a listing, so units sold = how many times this product appears
  // across paid Checkouts (a buyer purchasing the same product twice counts as
  // two). From that:
  //   SoldCount         → units sold across all paid checkouts
  //   RemainingQuantity → max(Quantity - SoldCount, 0)
  //   IsSold            → at least one unit sold
  //   Status:
  //     "Sold"        → no remaining stock (sold out)
  //     "Unavailable" → stock remains but IsAvailable === false (manually hidden)
  //     "Available"   → stock remains and IsAvailable === true
  getEnrichedWithStatus(match: Filter<Product>) {
    return this.aggregate([
      { $match: match },
      ...enrichmentStages(),
      {
        $lookup: {
          from: COLLECTIONS.CHECKOUT,
          let: { pid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$PaymentStatus", "Paid"] } } },
            // Count occurrences of this product within each paid checkout so a
            // quantity > 1 purchase is fully reflected in the sold tally.
            {
              $project: {
                count: {
                  $size: {
                    $filter: {
                      input: { $ifNull: ["$ProductIDs", []] },
                      as: "p",
                      cond: { $eq: ["$$p", "$$pid"] },
                    },
                  },
                },
              },
            },
            { $match: { count: { $gt: 0 } } },
          ],
          as: "PaidOrders",
        },
      },
      {
        $addFields: {
          SoldCount: { $sum: "$PaidOrders.count" },
        },
      },
      {
        $addFields: {
          IsSold: { $gt: ["$SoldCount", 0] },
          RemainingQuantity: {
            $max: [{ $subtract: ["$Quantity", "$SoldCount"] }, 0],
          },
          Status: {
            $cond: [
              { $lte: [{ $subtract: ["$Quantity", "$SoldCount"] }, 0] },
              "Sold",
              {
                $cond: [{ $eq: ["$IsAvailable", true] }, "Available", "Unavailable"],
              },
            ],
          },
        },
      },
      { $project: { PaidOrders: 0 } },
      { $sort: { DateListed: -1 } },
    ]);
  }

  // Validates a checkout's product list before payment. ProductIDs is a flat
  // array where a product appearing N times means N units requested. For each
  // distinct product we confirm it still exists, IsAvailable, and has enough
  // RemainingQuantity. Returns one issue per failing product; an empty array
  // means the whole order is purchasable.
  async checkAvailability(
    requestedIds: (string | ObjectId)[]
  ): Promise<{ ProductID: string; ProductName?: string; reason: string }[]> {
    const requested = new Map<string, number>();
    for (const id of requestedIds) {
      const key = id.toString();
      requested.set(key, (requested.get(key) ?? 0) + 1);
    }

    const uniqueIds = [...requested.keys()].map((k) => new ObjectId(k));
    const products = await this.getEnrichedWithStatus({
      _id: { $in: uniqueIds },
    } as Filter<Product>);
    const byId = new Map(products.map((p) => [p._id.toString(), p]));

    const issues: { ProductID: string; ProductName?: string; reason: string }[] =
      [];
    for (const [key, qty] of requested) {
      const p = byId.get(key);
      if (!p) {
        issues.push({ ProductID: key, reason: "Product no longer exists" });
        continue;
      }
      const name: string = p.ProductName ?? "Product";
      if (p.IsAvailable !== true) {
        issues.push({
          ProductID: key,
          ProductName: p.ProductName,
          reason: `${name} is no longer available`,
        });
        continue;
      }
      const remaining: number = p.RemainingQuantity ?? 0;
      if (remaining < qty) {
        issues.push({
          ProductID: key,
          ProductName: p.ProductName,
          reason: `${name} is out of stock (only ${remaining} left, ${qty} requested)`,
        });
      }
    }
    return issues;
  }

  setAvailability(ids: ObjectId[], IsAvailable: boolean) {
    return this.updateMany(
      { _id: { $in: ids } } as Filter<Product>,
      { $set: { IsAvailable } }
    );
  }

  // Bulk-attach an offer to many products (OfferID = ObjectId) or clear it from
  // them (OfferID = null). Used by the bulk offer-assignment endpoint.
  setOffer(ids: ObjectId[], OfferID: ObjectId | null) {
    return this.updateMany(
      { _id: { $in: ids } } as Filter<Product>,
      { $set: { OfferID } }
    );
  }

  // Fetch minimal product fields plus the active offer's DiscountPercentage (0 if
  // no active offer). Used at payment-verification time to snapshot the offer that
  // was live when the buyer paid — so changing the offer later never rewrites
  // historical earnings.
  findWithActiveOffer(ids: ObjectId[]) {
    return this.aggregate<{
      _id: ObjectId;
      UserID: ObjectId;
      Price: number;
      OfferDiscountPercentage: number;
      IsPriceInclusiveOfTax: boolean;
    }>([
      { $match: { _id: { $in: ids } } },
      {
        $lookup: {
          from: COLLECTIONS.OFFERS,
          localField: "OfferID",
          foreignField: "_id",
          as: "Offer",
        },
      },
      { $unwind: { path: "$Offer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          UserID: 1,
          Price: 1,
          IsPriceInclusiveOfTax: { $ifNull: ["$IsPriceInclusiveOfTax", false] },
          OfferDiscountPercentage: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ["$Offer._id", false] },
                  { $eq: ["$Offer.IsActive", true] },
                  { $lte: ["$Offer.StartDate", new Date()] },
                  { $gte: ["$Offer.EndDate", new Date()] },
                ],
              },
              then: "$Offer.DiscountPercentage",
              else: 0,
            },
          },
        },
      },
    ]);
  }
}

export const productRepository = new ProductRepository();
