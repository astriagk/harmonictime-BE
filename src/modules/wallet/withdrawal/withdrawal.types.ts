import { ObjectId } from "mongodb";

export type WithdrawalStatus = "Pending" | "Approved" | "Paid" | "Rejected";

// A copy of the destination bank details taken when the request is made, so the
// payout record stays accurate even if the seller later edits/deletes the account.
export interface BankSnapshot {
  AccountHolderName: string;
  AccountNumber: string;
  IFSC: string;
  BankName: string;
}

export interface Withdrawal {
  _id?: ObjectId;
  SellerID: ObjectId;
  BankAccountID: ObjectId;
  BankSnapshot: BankSnapshot;
  Amount: number;               // sum of covered earnings' NetAmount
  TotalGSTDeducted: number;     // sum of GSTAmount across covered earnings
  FinalPayableAmount: number;   // Amount - TotalGSTDeducted (actual bank transfer amount)
  EarningIDs: ObjectId[];
  Status: WithdrawalStatus;
  Reference?: string; // UTR / bank txn id, captured on Paid
  Notes?: string; // admin note, e.g. reason on Reject
  RequestedAt: Date;
  ProcessedAt?: Date;
  ProcessedBy?: ObjectId; // admin who paid/rejected
}
