import { ObjectId } from "mongodb";

export type VerificationStatus = "unverified" | "verified" | "failed";

export interface SellerBankAccount {
  _id?: ObjectId;
  SellerID: ObjectId;
  AccountHolderName: string;
  AccountNumber: string;
  IFSC: string;
  BankName: string;
  IsDefault: boolean;
  IsVerified: boolean;
  VerificationStatus: VerificationStatus;
  VerifiedAt?: Date;
  // Name returned by the bank during penny-drop — used as proof of ownership.
  VerifiedName?: string;
  CreatedAt: Date;
}
