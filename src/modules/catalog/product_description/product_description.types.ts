import { ObjectId } from "mongodb";

export interface ProductDescription {
  _id?: ObjectId;
  ProductID: ObjectId;
  Title?: string;
  Content?: string;
  AdditionalDetails?: string;
  CreatedAt?: Date;
}
