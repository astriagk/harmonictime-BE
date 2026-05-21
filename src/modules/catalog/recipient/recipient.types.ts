import { ObjectId } from "mongodb";

export interface Recipient {
  _id?: ObjectId;
  RecipientName: string;
}
