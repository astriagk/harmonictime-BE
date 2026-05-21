import { ObjectId } from "mongodb";

export interface Offer {
  _id?: ObjectId;
  OfferName: string;
  Description?: string;
  DiscountPercentage: number;
  StartDate: Date;
  EndDate: Date;
  IsActive: boolean;
}
