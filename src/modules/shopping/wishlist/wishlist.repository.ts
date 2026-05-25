import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { WishlistItem } from "./wishlist.types";

class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor() {
    super(COLLECTIONS.WISHLIST);
  }

  findByUserAndProduct(userId: ObjectId, productId: ObjectId) {
    return this.findOne({ UserID: userId, ProductID: productId });
  }

  findByUser(userId: string | ObjectId) {
    return this.find({ UserID: this.toObjectId(userId) });
  }

  // Wishlist lines joined to available product + description / details / images / delivery.
  getEnrichedByUser(userId: ObjectId) {
    return this.aggregate([
      { $match: { UserID: userId } },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCTS,
          localField: "ProductID",
          foreignField: "_id",
          as: "ProductDetails",
        },
      },
      {
        $unwind: { path: "$ProductDetails", preserveNullAndEmptyArrays: false },
      },
      { $match: { "ProductDetails.IsAvailable": true } },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_DESCRIPTION,
          localField: "ProductID",
          foreignField: "ProductID",
          as: "ProductDescription",
        },
      },
      {
        $unwind: {
          path: "$ProductDescription",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_DETAILS,
          localField: "ProductID",
          foreignField: "ProductID",
          as: "ProductSpecs",
        },
      },
      { $unwind: { path: "$ProductSpecs", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_IMAGES,
          localField: "ProductID",
          foreignField: "ProductID",
          as: "Images",
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.DELIVERY_RETURNS,
          localField: "ProductID",
          foreignField: "ProductID",
          as: "DeliveryAndReturns",
        },
      },
      {
        $unwind: {
          path: "$DeliveryAndReturns",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.OFFERS,
          localField: "ProductDetails.OfferID",
          foreignField: "_id",
          as: "Offer",
        },
      },
      { $unwind: { path: "$Offer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          UserID: 1,
          ProductID: 1,
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
            ManufacturerProductNumber:
              "$ProductSpecs.ManufacturerProductNumber",
            Guarantee: "$ProductSpecs.Guarantee",
          },
          Images: 1,
          DeliveryAndReturns: 1,
        },
      },
    ]);
  }
}

export const wishlistRepository = new WishlistRepository();
