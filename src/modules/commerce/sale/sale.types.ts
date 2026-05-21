import { ObjectId } from "mongodb";

export interface Sale {
  _id?: ObjectId;
  BuyerID: ObjectId;
  SellerID: ObjectId;
  ProductID: ObjectId;
  OfferID?: ObjectId | null;
  SaleDate: Date;
  SalePrice: number;
  DiscountAmount: number;
  FinalPrice: number;
}
