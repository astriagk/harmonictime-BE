import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { Checkout } from "./checkout.types";

class CheckoutRepository extends BaseRepository<Checkout> {
  constructor() {
    super(COLLECTIONS.CHECKOUT);
  }

  // Checkouts for a user with per-product price breakdown:
  //   Price               – seller's original listed price
  //   OfferApplied        – offer active at purchase time (null if none)
  //   EffectivePrice      – Price after offer discount
  //   BuyerCommissionAmount – platform's buyer-side cut
  //   DisplayPrice        – what the buyer paid per unit (EffectivePrice + BuyerCommissionAmount)
  getEnrichedByUser(userId: ObjectId) {
    const buyerRate = env.BUYER_COMMISSION_RATE;
    return this.aggregate([
      { $match: { UserID: userId } },
      { $lookup: { from: COLLECTIONS.PRODUCTS, localField: "ProductIDs", foreignField: "_id", as: "Products" } },
      { $lookup: { from: COLLECTIONS.PRODUCT_IMAGES, localField: "ProductIDs", foreignField: "ProductID", as: "ProductImages" } },
      // Shipment / tracking details for this checkout (latest first).
      {
        $lookup: {
          from: COLLECTIONS.SHIPMENTS,
          let: { cid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$CheckoutID", "$$cid"] } } },
            { $sort: { CreatedAt: -1 } },
            {
              $project: {
                _id: 1,
                Courier: 1,
                TrackingNumber: 1,
                TrackingURL: 1,
                ShipmentStatus: 1,
                ShippedAt: 1,
                EstimatedDelivery: 1,
                DeliveredAt: 1,
              },
            },
          ],
          as: "Shipments",
        },
      },
      { $unwind: "$Products" },
      // Join the earning snapshot for this product+checkout to get offer &
      // commission amounts that were locked in at payment time.
      {
        $lookup: {
          from: COLLECTIONS.SELLER_EARNINGS,
          let: { cid: "$_id", pid: "$Products._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$CheckoutID", "$$cid"] },
                    { $eq: ["$ProductID", "$$pid"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "Earning",
        },
      },
      {
        $addFields: {
          Earning: { $arrayElemAt: ["$Earning", 0] },
          PrimaryImage: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$ProductImages",
                  as: "image",
                  cond: {
                    $and: [
                      { $eq: ["$$image.ProductID", "$Products._id"] },
                      { $eq: ["$$image.IsPrimary", true] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          TotalAmount: { $first: "$TotalAmount" },
          PaymentStatus: { $first: "$PaymentStatus" },
          CheckoutDate: { $first: "$CheckoutDate" },
          DeliveryStatus: { $first: "$DeliveryStatus" },
          Shipments: { $first: "$Shipments" },
          Products: {
            $push: {
              ProductID: "$Products._id",
              ProductName: "$Products.ProductName",
              // Offer that was active when this unit was purchased (null if none).
              OfferApplied: {
                $cond: [
                  { $gt: [{ $ifNull: ["$Earning.OfferDiscountPercentage", 0] }, 0] },
                  {
                    DiscountPercentage: "$Earning.OfferDiscountPercentage",
                    DiscountAmount: "$Earning.OfferDiscountAmount",
                  },
                  null,
                ],
              },
              BuyerCommissionAmount: {
                $round: [
                  { $multiply: [{ $ifNull: ["$Earning.GrossAmount", "$Products.Price"] }, buyerRate] },
                  0,
                ],
              },
              // DisplayPrice = EffectivePrice + BuyerCommissionAmount
              DisplayPrice: {
                $add: [
                  { $ifNull: ["$Earning.GrossAmount", "$Products.Price"] },
                  {
                    $round: [
                      { $multiply: [{ $ifNull: ["$Earning.GrossAmount", "$Products.Price"] }, buyerRate] },
                      0,
                    ],
                  },
                ],
              },
              ImageURL: "$PrimaryImage.ImageURL",
            },
          },
        },
      },
      { $sort: { CheckoutDate: -1 } },
    ]);
  }

  // Orders that contain at least one product listed by this seller. Each order
  // shows ONLY that seller's line items, plus buyer + shipping details.
  getOrdersBySeller(sellerId: ObjectId) {
    return this.aggregate([
      {
        $lookup: {
          from: COLLECTIONS.PRODUCTS,
          localField: "ProductIDs",
          foreignField: "_id",
          as: "AllProducts",
        },
      },
      // Narrow each order's products to the ones owned by this seller.
      {
        $addFields: {
          SellerProducts: {
            $filter: {
              input: "$AllProducts",
              as: "p",
              cond: { $eq: ["$$p.UserID", sellerId] },
            },
          },
        },
      },
      // Drop orders that contain none of this seller's products.
      { $match: { "SellerProducts.0": { $exists: true } } },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_IMAGES,
          localField: "SellerProducts._id",
          foreignField: "ProductID",
          as: "ProductImages",
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.USERS,
          localField: "UserID",
          foreignField: "_id",
          as: "Buyer",
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.ADDRESS,
          localField: "AddressID",
          foreignField: "_id",
          as: "ShippingAddress",
        },
      },
      // This seller's shipment(s) for the order (latest first).
      {
        $lookup: {
          from: COLLECTIONS.SHIPMENTS,
          let: { cid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$CheckoutID", "$$cid"] },
                    { $eq: ["$SellerID", sellerId] },
                  ],
                },
              },
            },
            { $sort: { CreatedAt: -1 } },
          ],
          as: "Shipments",
        },
      },
      {
        $project: {
          TotalAmount: 1,
          PaymentStatus: 1,
          DeliveryStatus: 1,
          CheckoutDate: 1,
          // Only safe buyer fields — never password/otp.
          Buyer: {
            $let: {
              vars: { b: { $arrayElemAt: ["$Buyer", 0] } },
              in: { _id: "$$b._id", email: "$$b.email", phone: "$$b.phone" },
            },
          },
          ShippingAddress: { $arrayElemAt: ["$ShippingAddress", 0] },
          // Latest shipment for this seller on the order (null if not shipped yet).
          Shipment: {
            $let: {
              vars: { s: { $arrayElemAt: ["$Shipments", 0] } },
              in: {
                $cond: [
                  { $eq: [{ $type: "$$s" }, "object"] },
                  {
                    _id: "$$s._id",
                    Courier: "$$s.Courier",
                    TrackingNumber: "$$s.TrackingNumber",
                    TrackingURL: "$$s.TrackingURL",
                    ShipmentStatus: "$$s.ShipmentStatus",
                    ShippedAt: "$$s.ShippedAt",
                    EstimatedDelivery: "$$s.EstimatedDelivery",
                    DeliveredAt: "$$s.DeliveredAt",
                  },
                  null,
                ],
              },
            },
          },
          Products: {
            $map: {
              input: "$SellerProducts",
              as: "p",
              in: {
                ProductID: "$$p._id",
                ProductName: "$$p.ProductName",
                Price: "$$p.Price",
                ImageURL: {
                  $let: {
                    vars: {
                      img: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$ProductImages",
                              as: "im",
                              cond: {
                                $and: [
                                  { $eq: ["$$im.ProductID", "$$p._id"] },
                                  { $eq: ["$$im.IsPrimary", true] },
                                ],
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$img.ImageURL",
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { CheckoutDate: -1 } },
    ]);
  }
}

export const checkoutRepository = new CheckoutRepository();
