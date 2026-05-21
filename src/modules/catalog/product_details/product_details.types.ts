import { ObjectId } from "mongodb";

export interface ProductDetails {
  _id?: ObjectId;
  ProductID: ObjectId;
  DialColorID?: ObjectId | null;
  MovementID?: ObjectId | null;
  StrapMaterialID?: ObjectId | null;
  CaseMaterialID?: ObjectId | null;
  WatchMarkersID?: ObjectId | null;
  DeliveryOptionID?: ObjectId | null;
  Diameter?: string;
  WaterResistant?: string;
  ManufacturerProductNumber?: string;
  Guarantee?: string;
}
