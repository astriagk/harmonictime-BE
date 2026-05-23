import { ObjectId } from "mongodb";

export interface SellerBankAccount {
  _id?: ObjectId;
  SellerID: ObjectId;
  AccountHolderName: string;
  AccountNumber: string;
  IFSC: string;
  BankName: string;
  IsDefault: boolean;
  CreatedAt: Date;
}
