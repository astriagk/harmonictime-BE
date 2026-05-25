import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { EarningStatus, SellerEarning } from "./earning.types";

const DAY_MS = 24 * 60 * 60 * 1000;

// A product as needed to mint an earning (subset of Product).
type SoldProduct = {
  _id: ObjectId;
  UserID: ObjectId;
  Price: number;
  OfferDiscountPercentage: number; // 0 if no active offer at sale time
};

class EarningRepository extends BaseRepository<SellerEarning> {
  constructor() {
    super(COLLECTIONS.SELLER_EARNINGS);
  }

  // Mint one Pending earning per sold product, applying the seller commission.
  // Offer discount and all amounts are snapshotted so later price/offer changes
  // never rewrite history. Buyer commission is NOT deducted here — it is added
  // on top of the buyer's DisplayPrice and stays with the platform separately.
  async createForCheckout(
    checkoutId: ObjectId,
    products: SoldProduct[]
  ): Promise<void> {
    if (products.length === 0) return;
    const sellerRate = env.PLATFORM_COMMISSION_RATE;
    const now = new Date();

    const docs: SellerEarning[] = products.map((p) => {
      const offerDiscount  = p.OfferDiscountPercentage ?? 0;
      const discountAmount = Math.round(p.Price * offerDiscount / 100);
      const effectivePrice = p.Price - discountAmount;
      const commission     = Math.round(effectivePrice * sellerRate);
      return {
        SellerID: p.UserID,
        CheckoutID: checkoutId,
        ProductID: p._id,
        OfferDiscountPercentage: offerDiscount,
        OfferDiscountAmount: discountAmount,
        GrossAmount: effectivePrice,
        CommissionRate: sellerRate,
        CommissionAmount: commission,
        NetAmount: effectivePrice - commission,
        Status: "Pending",
        SaleDate: now,
        WithdrawalID: null,
        CreatedAt: now,
      };
    });
    await this.insertMany(docs);
  }

  // Promote this seller's Pending earnings to Available once their shipment is
  // Delivered and the hold window has elapsed. Lazy alternative to a cron job —
  // call before reading the wallet or creating a withdrawal.
  async refreshEligibility(sellerId: ObjectId): Promise<void> {
    const cutoff = new Date(Date.now() - env.PAYOUT_HOLD_DAYS * DAY_MS);

    const eligible = await this.aggregate<{ _id: ObjectId; DeliveredAt: Date }>([
      { $match: { SellerID: sellerId, Status: "Pending" } },
      {
        $lookup: {
          from: COLLECTIONS.SHIPMENTS,
          let: { cid: "$CheckoutID", sid: "$SellerID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$CheckoutID", "$$cid"] },
                    { $eq: ["$SellerID", "$$sid"] },
                    { $eq: ["$ShipmentStatus", "Delivered"] },
                  ],
                },
              },
            },
            { $sort: { DeliveredAt: -1 } },
            { $limit: 1 },
          ],
          as: "Shipment",
        },
      },
      { $addFields: { DeliveredAt: { $arrayElemAt: ["$Shipment.DeliveredAt", 0] } } },
      { $match: { DeliveredAt: { $ne: null, $lte: cutoff } } },
      { $project: { DeliveredAt: 1 } },
    ]);

    if (eligible.length === 0) return;

    await this.collection.bulkWrite(
      eligible.map((e) => ({
        updateOne: {
          filter: { _id: e._id },
          update: {
            $set: {
              Status: "Available",
              AvailableAt: new Date(
                new Date(e.DeliveredAt).getTime() + env.PAYOUT_HOLD_DAYS * DAY_MS
              ),
            },
          },
        },
      }))
    );
  }

  // Totals per status (in NetAmount) for the wallet summary.
  async getBalances(sellerId: ObjectId) {
    const rows = await this.aggregate<{ _id: EarningStatus; total: number; count: number }>([
      { $match: { SellerID: sellerId } },
      { $group: { _id: "$Status", total: { $sum: "$NetAmount" }, count: { $sum: 1 } } },
    ]);
    const by = (s: EarningStatus) => rows.find((r) => r._id === s);
    const sum = (s: EarningStatus) => by(s)?.total ?? 0;
    const cnt = (s: EarningStatus) => by(s)?.count ?? 0;

    return {
      availableBalance: sum("Available"),
      pendingBalance: sum("Pending"),
      inProcessBalance: sum("Requested"),
      totalWithdrawn: sum("Settled"),
      totalEarned: sum("Pending") + sum("Available") + sum("Requested") + sum("Settled"),
      counts: {
        available: cnt("Available"),
        pending: cnt("Pending"),
        inProcess: cnt("Requested"),
        settled: cnt("Settled"),
      },
    };
  }

  // Itemized earnings with product name + primary image, optionally by status.
  getItems(sellerId: ObjectId, status?: EarningStatus) {
    return this.aggregate([
      { $match: { SellerID: sellerId, ...(status ? { Status: status } : {}) } },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCTS,
          localField: "ProductID",
          foreignField: "_id",
          as: "Product",
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_IMAGES,
          let: { pid: "$ProductID" },
          pipeline: [
            { $match: { $expr: { $eq: ["$ProductID", "$$pid"] } } },
            { $sort: { IsPrimary: -1 } },
            { $limit: 1 },
          ],
          as: "Image",
        },
      },
      {
        $project: {
          ProductID: 1,
          CheckoutID: 1,
          WithdrawalID: 1,
          Status: 1,
          OfferDiscountPercentage: 1,
          OfferDiscountAmount: 1,
          GrossAmount: 1,
          CommissionRate: 1,
          CommissionAmount: 1,
          NetAmount: 1,
          SaleDate: 1,
          AvailableAt: 1,
          ProductName: { $arrayElemAt: ["$Product.ProductName", 0] },
          ImageURL: { $arrayElemAt: ["$Image.ImageURL", 0] },
        },
      },
      { $sort: { SaleDate: -1 } },
    ]);
  }

  // Earnings currently withdrawable for this seller.
  findAvailable(sellerId: ObjectId) {
    return this.find({ SellerID: sellerId, Status: "Available" });
  }

  // Lock a set of Available earnings into a withdrawal.
  lockForWithdrawal(earningIds: ObjectId[], withdrawalId: ObjectId) {
    return this.updateMany(
      { _id: { $in: earningIds }, Status: "Available" },
      { $set: { Status: "Requested", WithdrawalID: withdrawalId } }
    );
  }

  // Mark a withdrawal's earnings as paid out.
  settle(withdrawalId: ObjectId) {
    return this.updateMany(
      { WithdrawalID: withdrawalId, Status: "Requested" },
      { $set: { Status: "Settled" } }
    );
  }

  // Release a withdrawal's earnings back to Available (on reject/cancel).
  release(withdrawalId: ObjectId) {
    return this.updateMany(
      { WithdrawalID: withdrawalId, Status: "Requested" },
      { $set: { Status: "Available", WithdrawalID: null } }
    );
  }
}

export const earningRepository = new EarningRepository();
