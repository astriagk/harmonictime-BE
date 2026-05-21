import { ObjectId } from "mongodb";

export interface Address {
  _id?: ObjectId;
  UserID: ObjectId;
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
  IsDefault: boolean;
}
