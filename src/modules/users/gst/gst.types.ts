import { ObjectId } from "mongodb";

export type GSTBusinessType =
  | "Proprietorship"
  | "Partnership"
  | "Private Limited"
  | "LLP"
  | "Other";

export type GSTDocumentType =
  | "GSTCertificate"
  | "AddressProof"
  | "PANCard"
  | "CancelledCheque"
  | "BankStatement"
  | "Other";

export interface GSTDocument {
  url: string;
  key?: string;
  documentType?: GSTDocumentType;
}

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
  Documents?: GSTDocument[];
  IsVerified: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}
