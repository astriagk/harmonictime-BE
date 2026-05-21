import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { CartItem } from "./cart.types";

class CartRepository extends BaseRepository<CartItem> {
  constructor() {
    super(COLLECTIONS.CART);
  }

  findByUserAndProduct(userId: ObjectId, productId: ObjectId) {
    return this.findOne({ UserID: userId, ProductID: productId });
  }

  // Cart lines joined to available product + description / details / images / delivery.
  getEnrichedByUser(userId: ObjectId) {
    return this.aggregate([
      { $match: { UserID: userId } },
      { $lookup: { from: COLLECTIONS.PRODUCTS, localField: "ProductID", foreignField: "_id", as: "ProductDetails" } },
      { $unwind: { path: "$ProductDetails", preserveNullAndEmptyArrays: false } },
      { $match: { "ProductDetails.IsAvailable": true } },
      { $lookup: { from: COLLECTIONS.PRODUCT_DESCRIPTION, localField: "ProductID", foreignField: "ProductID", as: "ProductDescription" } },
      { $unwind: { path: "$ProductDescription", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: COLLECTIONS.PRODUCT_DETAILS, localField: "ProductID", foreignField: "ProductID", as: "ProductSpecs" } },
      { $unwind: { path: "$ProductSpecs", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: COLLECTIONS.PRODUCT_IMAGES, localField: "ProductID", foreignField: "ProductID", as: "Images" } },
      { $lookup: { from: COLLECTIONS.DELIVERY_RETURNS, localField: "ProductID", foreignField: "ProductID", as: "DeliveryAndReturns" } },
      { $unwind: { path: "$DeliveryAndReturns", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          UserID: 1,
          ProductID: 1,
          Quantity: 1,
          ProductName: "$ProductDetails.ProductName",
          Price: "$ProductDetails.Price",
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
