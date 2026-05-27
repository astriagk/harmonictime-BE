import { ObjectId } from "mongodb";

export type ProductApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface Product {
  _id?: ObjectId;
  UserID: ObjectId;
  ProductName: string;
  BrandID: ObjectId;
  CollectionID: ObjectId;
  CategoryID: ObjectId;
  RecipientID: ObjectId;
  Price: number;
  // Total units available for this listing. One Product document represents the
  // whole stock — the same _id is used for every unit. Units sold are derived by
  // counting the product across paid checkouts (see getEnrichedWithStatus).
  Quantity: number;
  // Optional promotional offer attached to this product (Offers collection).
  OfferID?: ObjectId | null;
  IsAvailable: boolean;
  DateListed: Date;
  // true = seller's Price already includes 18% GST; false = price is GST-exclusive.
  IsPriceInclusiveOfTax: boolean;
  // Admin moderation: products start Pending and only show to buyers once Approved.
  ApprovalStatus: ProductApprovalStatus;
  ApprovalNote?: string;       // Reason surfaced to the seller on Rejected
  ApprovedBy?: ObjectId;       // Admin who approved/rejected
  ApprovedAt?: Date;
}
