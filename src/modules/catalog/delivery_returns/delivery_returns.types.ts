import { ObjectId } from "mongodb";

export interface DeliveryReturn {
  _id?: ObjectId;
  ProductID: ObjectId;
  DeliveryInformation?: string;
  ReturnsPolicy?: string;
  CreatedAt?: Date;
}
