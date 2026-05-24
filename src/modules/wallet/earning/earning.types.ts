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
  GrossAmount: number; // snapshot of Product.Price at sale time
  CommissionRate: number; // platform rate applied (e.g. 0.1)
  CommissionAmount: number; // GrossAmount * CommissionRate
  NetAmount: number; // GrossAmount - CommissionAmount = seller's credit
  Status: EarningStatus;
  SaleDate: Date;
  AvailableAt?: Date; // when it became Available (DeliveredAt + hold)
  WithdrawalID?: ObjectId | null; // set when locked into a Withdrawal
  CreatedAt: Date;
}
