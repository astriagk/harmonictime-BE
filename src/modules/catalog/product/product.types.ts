import { ObjectId } from "mongodb";

export interface Product {
  _id?: ObjectId;
  UserID: ObjectId;
  ProductName: string;
  BrandID: ObjectId;
  CollectionID: ObjectId;
  CategoryID: ObjectId;
  RecipientID: ObjectId;
  Price: number;
  IsAvailable: boolean;
  DateListed: Date;
}
