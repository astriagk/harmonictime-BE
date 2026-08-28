import { ObjectId } from "mongodb";

// Lifecycle of a single sold-item earning:
//   Pending   – sold, but not yet withdrawable (shipment not delivered, or still
//               inside the post-delivery hold window)
//   Available – delivered + hold window elapsed; counts toward withdrawable balance
//   Requested – locked into a pending Withdrawal
//   Settled   – paid out to the seller
export type EarningStatus = "Pending" | "Available" | "Requested" | "Settled";

export interface SellerEarning {
  _id?: ObjectId;
  SellerID: ObjectId;
  CheckoutID: ObjectId;
  ProductID: ObjectId;
  // Offer state snapshotted at sale time so later offer changes never rewrite history.
  OfferDiscountPercentage: number; // e.g. 10 for 10% off; 0 if no active offer
  OfferDiscountAmount: number;     // Math.round(Price * OfferDiscountPercentage / 100)
  GrossAmount: number;             // effective price buyer paid per unit = Price - OfferDiscountAmount
  CommissionRate: number;          // seller commission rate applied (e.g. 0.02)
  CommissionAmount: number;        // round((GrossAmount + GSTAmount) * CommissionRate) — charged on the GST-inclusive amount
  NetAmount: number;               // GrossAmount - CommissionAmount = seller's credit, GST excluded
  // GST fields — snapshotted from the product at sale time.
  // GST is never platform revenue and is never deducted from the seller:
  //   IsTaxInclusive = true  → GST already sits inside the price. Nothing extra
  //                            is charged to the buyer, nothing is deducted.
  //                            GSTAmount = 0; the seller remits from the price.
  //   IsTaxInclusive = false → GST is collected from the buyer on top of
  //                            GrossAmount and passed through to the seller,
  //                            who remits it. GSTAmount = round(Gross × rate/100).
  IsTaxInclusive: boolean;         // copied from Product.IsPriceInclusiveOfTax
  GSTRate: number;                 // GST rate in % (default 18); stored for future rate changes
  GSTAmount: number;               // GST collected from the buyer for this unit; 0 when inclusive
  NetPayableAmount: number;        // NetAmount + GSTAmount — what actually reaches the seller
  Status: EarningStatus;
  SaleDate: Date;
  AvailableAt?: Date; // when it became Available (DeliveredAt + hold)
  WithdrawalID?: ObjectId | null; // set when locked into a Withdrawal
  CreatedAt: Date;
}
