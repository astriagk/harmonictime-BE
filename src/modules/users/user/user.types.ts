import { ObjectId } from "mongodb";

export type UserStatus = "active" | "blocked" | "suspended";
export type AccountType = "individual" | "business";
export type SellerVerificationStatus = "Unverified" | "Pending" | "Approved" | "Rejected";

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
  profilePicUrl?: string;
  accountType?: AccountType;
  businessName?: string;
  // Seller verification: admin reviews the seller's profile and sets this.
  // Sellers start as "Unverified". Once they submit details they move to "Pending".
  sellerVerificationStatus?: SellerVerificationStatus;
  sellerVerificationNote?: string;  // Reason shown to the seller on Rejected / info-request
  sellerVerifiedBy?: ObjectId;      // Admin who last updated the status
  sellerVerifiedAt?: Date;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  emailVerificationToken?: string;  // SHA-256 hash of the raw token sent in the link
  emailVerificationTokenExpiry?: Date;
  postVerificationRedirect?: string;
}
