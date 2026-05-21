import { ObjectId } from "mongodb";

export interface Review {
  _id?: ObjectId;
  ProductID: ObjectId; // product being reviewed
  Rating: number; // 1–5
  Name: string; // reviewer display name (guest allowed)
  Email: string; // reviewer email (guest allowed)
  Comment: string; // review text
  CreatedAt: Date;
}
