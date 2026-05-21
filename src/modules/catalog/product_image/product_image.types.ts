import { ObjectId } from "mongodb";

export interface ProductImage {
  _id?: ObjectId;
  ProductID: ObjectId;
  ImageURL: string;
  key?: string;
  IsPrimary: boolean;
  AltText?: string;
}
