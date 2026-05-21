import crypto from "crypto";

// Generate a 6-digit OTP.
export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Hash an OTP for at-rest storage.
export const hashOTP = (otp: string): string =>
  crypto.createHash("sha256").update(otp).digest("hex");
