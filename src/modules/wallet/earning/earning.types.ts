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
  CommissionAmount: number;        // Math.round(GrossAmount * CommissionRate)
  NetAmount: number;               // GrossAmount - CommissionAmount = seller's credit
  Status: EarningStatus;
  SaleDate: Date;
  AvailableAt?: Date; // when it became Available (DeliveredAt + hold)
  WithdrawalID?: ObjectId | null; // set when locked into a Withdrawal
  CreatedAt: Date;
}
