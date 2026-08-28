import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { env } from "../../../shared/config/env";
import { computeUnitPricing } from "../../../shared/utils/pricing";
import { EarningStatus, SellerEarning } from "./earning.types";

const DAY_MS = 24 * 60 * 60 * 1000;

// A product as needed to mint an earning (subset of Product).
type SoldProduct = {
  _id: ObjectId;
  UserID: ObjectId;
  Price: number;
  OfferDiscountPercentage: number;   // 0 if no active offer at sale time
  IsPriceInclusiveOfTax: boolean;    // snapshotted for GST calculation
};

class EarningRepository extends BaseRepository<SellerEarning> {
  constructor() {
    super(COLLECTIONS.SELLER_EARNINGS);
  }

  // Mint one Pending earning per sold product, applying the seller commission.
  // Offer discount and all amounts are snapshotted so later price/offer changes
  // never rewrite history.
  //
  // GST is NEVER deducted from the seller. For a tax-exclusive product the GST
  // is collected from the buyer on top of the price and passed straight through
  // to the seller, who remits it; for a tax-inclusive product it already sits
  // inside the price and is likewise the seller's to remit. The platform's only
  // cut is the commission, charged on the GST-inclusive amount. See
  // shared/utils/pricing.ts for the canonical formula.
  async createForCheckout(
    checkoutId: ObjectId,
    products: SoldProduct[],
    qtyMap: Map<string, number>
  ): Promise<void> {
    if (products.length === 0) return;
    const now = new Date();

    const docs: SellerEarning[] = products.flatMap((p) => {
      const pricing = computeUnitPricing(
        p.Price,
        p.OfferDiscountPercentage ?? 0,
        p.IsPriceInclusiveOfTax ?? false
      );

      const qty = qtyMap.get(p._id.toString()) ?? 1;
      return Array.from({ length: qty }, () => ({
        SellerID: p.UserID,
        CheckoutID: checkoutId,
        ProductID: p._id,
        OfferDiscountPercentage: pricing.OfferDiscountPercentage,
        OfferDiscountAmount: pricing.OfferDiscountAmount,
        GrossAmount: pricing.EffectivePrice,
        CommissionRate: pricing.SellerCommissionRate,
        CommissionAmount: pricing.SellerCommissionAmount,
        NetAmount: pricing.NetAmount,
        IsTaxInclusive: pricing.IsTaxInclusive,
        GSTRate: pricing.GSTRate,
        GSTAmount: pricing.GSTAmount,
        NetPayableAmount: pricing.NetPayableAmount,
        Status: "Pending" as const,
        SaleDate: now,
        WithdrawalID: null,
        CreatedAt: now,
      }));
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

  // Totals per status (in NetPayableAmount) for the wallet summary.
  // Legacy earnings predate NetPayableAmount and fall back to NetAmount: they
  // were sold when no GST was collected from the buyer, so NetAmount is exactly
  // what is owed. Their old NetAmountAfterGST field is deliberately ignored --
  // it deducted GST the platform never actually collected.
  // counts reflect distinct product lines (CheckoutID+ProductID groups), not raw units.
  async getBalances(sellerId: ObjectId) {
    const rows = await this.aggregate<{ _id: EarningStatus; total: number; count: number }>([
      { $match: { SellerID: sellerId } },
      {
        $group: {
          _id: { status: "$Status", checkoutId: "$CheckoutID", productId: "$ProductID" },
          status: { $first: "$Status" },
          lineTotal: { $sum: { $ifNull: ["$NetPayableAmount", "$NetAmount"] } },
        },
      },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$lineTotal" },
          count: { $sum: 1 },
        },
      },
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

  // Itemized earnings grouped by CheckoutID + ProductID, with quantity and
  // total amounts. Each row represents one product line in one order.
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
      // Group multiple earning docs (one per unit) into a single product line.
      {
        $group: {
          _id: { CheckoutID: "$CheckoutID", ProductID: "$ProductID" },
          CheckoutID: { $first: "$CheckoutID" },
          ProductID: { $first: "$ProductID" },
          WithdrawalID: { $first: "$WithdrawalID" },
          Status: { $first: "$Status" },
          OfferDiscountPercentage: { $first: "$OfferDiscountPercentage" },
          // Per-unit amounts (identical across all docs in the group).
          GrossAmount: { $first: "$GrossAmount" },
          CommissionRate: { $first: "$CommissionRate" },
          CommissionAmount: { $first: "$CommissionAmount" },
          NetAmount: { $first: "$NetAmount" },
          IsTaxInclusive: { $first: "$IsTaxInclusive" },
          GSTRate: { $first: "$GSTRate" },
          GSTAmount: { $first: "$GSTAmount" },
          NetPayableAmount: { $first: "$NetPayableAmount" },
          SaleDate: { $first: "$SaleDate" },
          AvailableAt: { $first: "$AvailableAt" },
          Quantity: { $sum: 1 },
          // Totals across all units in the group.
          TotalGrossAmount: { $sum: "$GrossAmount" },
          TotalCommissionAmount: { $sum: "$CommissionAmount" },
          TotalNetAmount: { $sum: "$NetAmount" },
          TotalGSTAmount: { $sum: "$GSTAmount" },
          TotalNetPayableAmount: { $sum: { $ifNull: ["$NetPayableAmount", "$NetAmount"] } },
          TotalOfferDiscountAmount: { $sum: "$OfferDiscountAmount" },
          ProductName: { $first: { $arrayElemAt: ["$Product.ProductName", 0] } },
          ImageURL: { $first: { $arrayElemAt: ["$Image.ImageURL", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          CheckoutID: 1,
          ProductID: 1,
          WithdrawalID: 1,
          Status: 1,
          OfferDiscountPercentage: 1,
          Quantity: 1,
          // Per-unit amounts.
          GrossAmount: 1,
          CommissionRate: 1,
          CommissionAmount: 1,
          NetAmount: 1,
          IsTaxInclusive: 1,
          GSTRate: 1,
          GSTAmount: 1,
          NetPayableAmount: 1,
          // Total amounts for the line (per-unit × quantity).
          TotalGrossAmount: 1,
          TotalCommissionAmount: 1,
          TotalNetAmount: 1,
          TotalGSTAmount: 1,
          TotalOfferDiscountAmount: 1,
          TotalNetPayableAmount: 1,
          SaleDate: 1,
          AvailableAt: 1,
          ProductName: 1,
          ImageURL: 1,
        },
      },
      { $sort: { SaleDate: -1 } },
    ]);
  }

  // Total cumulative gross sales for a seller across all time (used for GST threshold check).
  async getTotalGrossSales(sellerId: ObjectId): Promise<number> {
    const rows = await this.aggregate<{ total: number }>([
      { $match: { SellerID: sellerId } },
      { $group: { _id: null, total: { $sum: "$GrossAmount" } } },
    ]);
    return rows[0]?.total ?? 0;
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
