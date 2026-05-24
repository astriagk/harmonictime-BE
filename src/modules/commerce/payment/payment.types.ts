import { ObjectId } from "mongodb";

// "RefundPending": payment captured, but stock sold out before the order could
// be confirmed at verifyPayment — awaiting refund, no Checkout was created.
export type PaymentStatus =
  | "Created"
  | "Verified"
  | "Failed"
  | "RefundPending";

// Address fields captured at order time but NOT persisted to the Address
// collection until the payment is verified.
export interface DraftAddress {
  FirstName: string;
  LastName: string;
  Country: string;
  AddressLine1: string;
  AddressLine2?: string;
  City: string;
  State: string;
  PostalCode: string;
  Phone: string;
  orderNotes?: string;
  IsDefault?: boolean;
}

// Checkout fields captured at order time, materialized on payment verification.
export interface DraftCheckout {
  ProductIDs: string[];
  TotalAmount: number;
  DeliveryStatus?: string;
  CheckoutDate?: string;
}

export interface OrderDraft {
  address: DraftAddress;
  checkout: DraftCheckout;
}

export interface Payment {
  _id?: ObjectId;
  // Set only after the payment is verified — the Address/Checkout don't exist
  // until then.
  CheckoutID?: ObjectId;
  AddressID?: ObjectId;
  UserID: ObjectId;
  Amount: number;
  Currency: string;
  RazorpayOrderID: string;
  RazorpayPaymentID?: string;
  RazorpaySignature?: string;
  PaymentMethod?: string;
  PaymentStatus: PaymentStatus;
  Receipt?: string;
  // Pending address + checkout data, written to their collections on verify.
  Draft?: OrderDraft;
  PaidAt?: Date;
  CreatedAt: Date;
}
