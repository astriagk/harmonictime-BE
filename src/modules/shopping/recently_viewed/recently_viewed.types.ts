import { ObjectId } from "mongodb";

export interface RecentlyViewed {
  _id?: ObjectId;
  UserID: ObjectId;
  ProductID: ObjectId;
  ViewedAt: Date;
}
