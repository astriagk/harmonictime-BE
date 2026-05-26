import { ObjectId } from "mongodb";

export interface UserReview {
  _id?: ObjectId;
  UserID: ObjectId; // seller being reviewed (resolved from ProductID)
  ProductID: ObjectId; // product the buyer purchased
  Rating: number; // 1–5
  Subject: string; // short title for the review
  Name?: string; // reviewer display name (optional)
  Email: string; // reviewer email
  Comment: string; // review text
  CreatedAt: Date;
}
