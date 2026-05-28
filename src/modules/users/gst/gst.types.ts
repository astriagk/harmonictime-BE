import { ObjectId } from "mongodb";

export type GSTBusinessType =
  | "Proprietorship"
  | "Partnership"
  | "Private Limited"
  | "LLP"
  | "Other";

export interface SellerGSTDetails {
  _id?: ObjectId;
  UserID: ObjectId;
  GSTIN: string;
  LegalBusinessName: string;
  TradeName?: string;
  BusinessType?: GSTBusinessType;
  RegisteredAddress?: string;
  State?: string;
  PinCode?: string;
  IsVerified: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}
