import { ObjectId } from "mongodb";

export interface OrderItem {
  ProductID: ObjectId;
  OrderItemID: string;
}

export interface SellerConfirmation {
  SellerID: ObjectId;
  Status: "Pending" | "Approved" | "Rejected";
  Reason?: string;
  UpdatedAt: Date;
}

export interface Checkout {
  _id?: ObjectId;
  OrderID: string;
  UserID: ObjectId;
  AddressID: ObjectId;
  TotalAmount: number;
  PaymentStatus: string;
  DeliveryStatus: string;
  CheckoutDate: Date;
  ProductIDs: ObjectId[];
  OrderItems: OrderItem[];
  SellerConfirmations: SellerConfirmation[];
}
