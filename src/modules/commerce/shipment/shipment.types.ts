import { ObjectId } from "mongodb";

export type ShipmentStatus =
  | "Pending"
  | "Shipped"
  | "InTransit"
  | "OutForDelivery"
  | "Delivered";

export interface TrackingEvent {
  Status: string;
  Location?: string;
  Description?: string;
  Timestamp: Date;
}

export interface Shipment {
  _id?: ObjectId;
  CheckoutID: ObjectId;
  SellerID: ObjectId;
  Courier: string;
  TrackingNumber: string;
  TrackingURL?: string;
  ShipmentStatus: ShipmentStatus;
  ShippedAt?: Date;
  EstimatedDelivery?: Date;
  DeliveredAt?: Date;
  Notes?: string;
  CreatedAt: Date;
  TrackingProvider?: string;
  TrackingEvents?: TrackingEvent[];
  LastTrackedAt?: Date;
}
