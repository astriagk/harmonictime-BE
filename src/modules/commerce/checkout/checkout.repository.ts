import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Checkout } from "./checkout.types";

class CheckoutRepository extends BaseRepository<Checkout> {
  constructor() {
    super(COLLECTIONS.CHECKOUT);
  }

  // Checkouts for a user with each product's name/price/primary image.
  getEnrichedByUser(userId: ObjectId) {
    return this.aggregate([
      { $match: { UserID: userId } },
      { $lookup: { from: COLLECTIONS.PRODUCTS, localField: "ProductIDs", foreignField: "_id", as: "Products" } },
      { $lookup: { from: COLLECTIONS.PRODUCT_IMAGES, localField: "ProductIDs", foreignField: "ProductID", as: "ProductImages" } },
      { $unwind: "$Products" },
      {
        $addFields: {
          ImageURL: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$ProductImages",
                  as: "image",
                  cond: { $eq: ["$$image.ProductID", "$Products._id"] },
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
          Products: {
            $push: {
              ProductName: "$Products.ProductName",
              Price: "$Products.Price",
              ImageURL: "$ImageURL.ImageURL",
            },
          },
        },
      },
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
                              cond: { $eq: ["$$im.ProductID", "$$p._id"] },
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
