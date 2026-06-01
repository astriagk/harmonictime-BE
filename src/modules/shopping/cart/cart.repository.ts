import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { CartItem } from "./cart.types";

class CartRepository extends BaseRepository<CartItem> {
  constructor() {
    super(COLLECTIONS.CART);
  }

  findByUserAndProduct(userId: ObjectId, productId: ObjectId) {
    return this.findOne({ UserID: userId, ProductID: productId });
  }

  removeByUserAndProducts(userId: ObjectId, productIds: ObjectId[]) {
    return this.collection.deleteMany({ UserID: userId, ProductID: { $in: productIds } } as any);
  }

  // Cart lines joined to available product + description / details / images / delivery.
  getEnrichedByUser(userId: ObjectId) {
    return this.aggregate([
      { $match: { UserID: userId } },
      { $lookup: { from: COLLECTIONS.PRODUCTS, localField: "ProductID", foreignField: "_id", as: "ProductDetails" } },
      { $unwind: { path: "$ProductDetails", preserveNullAndEmptyArrays: false } },
      { $match: { "ProductDetails.IsAvailable": true } },
      // Count how many units of this product are already sold so we can derive
      // RemainingQuantity for the cart page quantity stepper.
      {
        $lookup: {
          from: COLLECTIONS.CHECKOUT,
          let: { pid: "$ProductID" },
          pipeline: [
            { $match: { $expr: { $eq: ["$PaymentStatus", "Paid"] } } },
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
          as: "_PaidOrders",
        },
      },
      {
        $addFields: {
          RemainingQuantity: {
            $max: [
              { $subtract: ["$ProductDetails.Quantity", { $sum: "$_PaidOrders.count" }] },
              0,
            ],
          },
        },
      },
      { $lookup: { from: COLLECTIONS.PRODUCT_DESCRIPTION, localField: "ProductID", foreignField: "ProductID", as: "ProductDescription" } },
      { $unwind: { path: "$ProductDescription", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: COLLECTIONS.PRODUCT_DETAILS, localField: "ProductID", foreignField: "ProductID", as: "ProductSpecs" } },
      { $unwind: { path: "$ProductSpecs", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: COLLECTIONS.PRODUCT_IMAGES, localField: "ProductID", foreignField: "ProductID", as: "Images" } },
      { $lookup: { from: COLLECTIONS.DELIVERY_RETURNS, localField: "ProductID", foreignField: "ProductID", as: "DeliveryAndReturns" } },
      { $unwind: { path: "$DeliveryAndReturns", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: COLLECTIONS.OFFERS, localField: "ProductDetails.OfferID", foreignField: "_id", as: "Offer" } },
      { $unwind: { path: "$Offer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          UserID: 1,
          ProductID: 1,
          Quantity: 1,
          ProductName: "$ProductDetails.ProductName",
          Price: "$ProductDetails.Price",
          DisplayPrice: {
            $add: [
              "$ProductDetails.Price",
              { $round: [{ $multiply: ["$ProductDetails.Price", env.BUYER_COMMISSION_RATE] }, 0] },
            ],
          },
          OfferID: "$ProductDetails.OfferID",
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
          RemainingQuantity: 1,
          IsAvailable: "$ProductDetails.IsAvailable",
          DateListed: "$ProductDetails.DateListed",
          Description: {
            Title: "$ProductDescription.Title",
            Content: "$ProductDescription.Content",
            AdditionalDetails: "$ProductDescription.AdditionalDetails",
            CreatedAt: "$ProductDescription.CreatedAt",
          },
          Details: {
            Diameter: "$ProductSpecs.Diameter",
            WaterResistant: "$ProductSpecs.WaterResistant",
            ManufacturerProductNumber: "$ProductSpecs.ManufacturerProductNumber",
            Guarantee: "$ProductSpecs.Guarantee",
          },
          Images: 1,
          DeliveryAndReturns: 1,
        },
      },
    ]);
  }
}

export const cartRepository = new CartRepository();
