import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  phone?: string;
  dateCreated?: Date;
  otp?: string;
  otpExpiry?: Date;
}
