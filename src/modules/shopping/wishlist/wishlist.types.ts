import { ObjectId } from "mongodb";

export interface WishlistItem {
  _id?: ObjectId;
  UserID: ObjectId;
  ProductID: ObjectId;
}
