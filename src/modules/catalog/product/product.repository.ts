import { Document, Filter, ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
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
      IsAvailable: 1,
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

  // Enriched products plus a derived Status:
  //  - "Sold"        → product appears in at least one paid Checkout
  //  - "Unavailable" → IsAvailable === false and not sold (manually hidden)
  //  - "Available"   → IsAvailable === true
  getEnrichedWithStatus(match: Filter<Product>) {
    return this.aggregate([
      { $match: match },
      ...enrichmentStages(),
      {
        $lookup: {
          from: COLLECTIONS.CHECKOUT,
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$$pid", "$ProductIDs"] },
                    { $eq: ["$PaymentStatus", "Paid"] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: "PaidOrders",
        },
      },
      {
        $addFields: {
          IsSold: { $gt: [{ $size: "$PaidOrders" }, 0] },
          Status: {
            $cond: [
              { $gt: [{ $size: "$PaidOrders" }, 0] },
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

  setAvailability(ids: ObjectId[], IsAvailable: boolean) {
    return this.updateMany(
      { _id: { $in: ids } } as Filter<Product>,
      { $set: { IsAvailable } }
    );
  }
}

export const productRepository = new ProductRepository();
