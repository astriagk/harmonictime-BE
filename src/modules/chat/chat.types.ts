import { ObjectId } from "mongodb";

export interface ChatThread {
  _id?: ObjectId;
  ProductID: ObjectId;
  BuyerID: ObjectId;
  SellerID: ObjectId;
  Status: "open" | "closed";
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface ChatMessage {
  _id?: ObjectId;
  ThreadID: ObjectId;
  SenderID: ObjectId;
  SenderRole: "buyer" | "seller";
  Text: string;
  IsRead: boolean;
  CreatedAt: Date;
}
