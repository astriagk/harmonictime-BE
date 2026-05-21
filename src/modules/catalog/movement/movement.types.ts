import { ObjectId } from "mongodb";

export interface Movement {
  _id?: ObjectId;
  MovementName: string;
}
