import { ObjectId } from "mongodb";

export type UserStatus = "active" | "blocked" | "suspended";
export type AccountType = "individual" | "business";
// How the account was originally created. Informational only — never branch an
// auth decision on this. Use `!!user.password` / `!!user.googleId` instead: an
// account can gain a password later (reset-password flow) or gain a googleId
// later (Google auto-link), so origin and capability are not the same thing.
export type AuthProvider = "local" | "google";
export type SellerVerificationStatus = "Unverified" | "Pending" | "Approved" | "Rejected" | "Resubmitted";

export interface User {
  _id?: ObjectId;
  email: string;
  // Optional: Google-created accounts have no password until the user runs the
  // reset-password flow. Every read site must guard for undefined.
  password?: string;
  googleId?: string;          // Google `sub` claim — stable per user, never reused
  authProvider?: AuthProvider; // absent on pre-existing rows, which are all "local"
  displayName?: string;        // Google `name` claim; local signup has no equivalent
  phone?: string;
  status?: UserStatus;
  dateCreated?: Date;
  otp?: string;
  otpExpiry?: Date;
  otpAttempts?: number;   // Wrong-guess counter; the OTP is voided past MAX_OTP_ATTEMPTS
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
