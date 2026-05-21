import { ObjectId } from "mongodb";

export interface CartItem {
  _id?: ObjectId;
  UserID: ObjectId;
  ProductID: ObjectId;
  Quantity?: number;
}
