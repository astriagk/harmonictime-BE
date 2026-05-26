import { ObjectId } from "mongodb";

export type MediaType = "image" | "video";

export interface ProductImage {
  _id?: ObjectId;
  ProductID: ObjectId;
  ImageURL: string;
  key?: string;
  IsPrimary: boolean;
  AltText?: string;
  mediaType?: MediaType;
}
