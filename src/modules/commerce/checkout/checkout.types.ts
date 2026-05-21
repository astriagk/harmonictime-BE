import { ObjectId } from "mongodb";

export interface Checkout {
  _id?: ObjectId;
  UserID: ObjectId;
  AddressID: ObjectId;
  TotalAmount: number;
  PaymentStatus: string;
  DeliveryStatus: string;
  CheckoutDate: Date;
  ProductIDs: ObjectId[];
}
