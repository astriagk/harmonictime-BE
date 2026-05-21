import { ObjectId } from "mongodb";

export interface WatchCollection {
  _id?: ObjectId;
  BrandID: ObjectId;
  CollectionName: string;
}
