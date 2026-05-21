import { ObjectId } from "mongodb";

export interface Category {
  _id?: ObjectId;
  CategoryName: string;
}
