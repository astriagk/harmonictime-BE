import { ObjectId } from "mongodb";

export type UserStatus = "active" | "blocked" | "suspended";

export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  phone?: string;
  status?: UserStatus;
  dateCreated?: Date;
  otp?: string;
  otpExpiry?: Date;
  refreshTokenHash?: string;
  acceptedTerms?: boolean;
  termsAcceptedAt?: Date;
}
