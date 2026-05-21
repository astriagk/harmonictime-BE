import { ObjectId } from "mongodb";

export interface CheckoutItem {
  _id?: ObjectId;
  CheckoutID: ObjectId;
  ProductIDs: ObjectId[];
  Price: number;
  Quantity?: number;
}
