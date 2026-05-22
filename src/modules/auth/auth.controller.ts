import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { DEFAULT_ROLE_ID } from "../../shared/constants/roles";
import { signToken, verifyToken } from "../../shared/services/token.service";
import { resetPasswordUrl } from "../../shared/constants/frontend";
import { sendTemplateEmail } from "../../shared/services/email.service";
import { sendSMS } from "../../shared/services/sms.service";
import {
  welcomeEmail,
  passwordResetOtpEmail,
} from "../../shared/email-templates";
import { generateOTP, hashOTP } from "../../shared/utils/otp";
import { userRepository } from "../users/user/user.repository";
import { userRoleRepository } from "../users/role/role.repository";

const OTP_TTL_MS = 10 * 60 * 1000;

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, phone } = req.body;

  const existing = await userRepository.findByEmail(email);
  if (existing) throw ApiError.conflict("Email already exists");

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await userRepository.insertOne({
    email,
    password: hashedPassword,
    phone,
    dateCreated: new Date(),
  });

  await userRoleRepository.insertOne({
    UserRoleID: DEFAULT_ROLE_ID,
    UserID: result.insertedId,
    RoleID: DEFAULT_ROLE_ID,
  });

  const token = signToken(
    { userId: result.insertedId.toString(), email },
    "1h",
  );

  // Welcome email — best-effort; the mailer swallows its own errors so a mail
  // failure never blocks account creation.
  await sendTemplateEmail(email, welcomeEmail());

  sendResponse(res, HTTP_STATUS.CREATED, "User created successfully", {
    userId: result.insertedId,
    token,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const token = signToken({ userId: user._id!.toString(), email: user.email });
  sendResponse(res, HTTP_STATUS.OK, "Login successful", { token });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.notFound("Email not found");

  const otp = generateOTP();
  await userRepository.updateOne(
    { email },
    {
      $set: { otp: hashOTP(otp), otpExpiry: new Date(Date.now() + OTP_TTL_MS) },
    },
  );

  // Signed token (userId, 10-min expiry) — the reset page sends it back so we
  // can identify the user without asking for email/phone again.
  const resetToken = signToken({ userId: user._id!.toString(), email }, "10m");

  const sent = await sendTemplateEmail(
    email,
    passwordResetOtpEmail(otp, resetToken),
  );
  if (!sent)
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Failed to send OTP email",
    );
  sendResponse(res, HTTP_STATUS.OK, "OTP sent to email");
});

export const verifyPhone = asyncHandler(async (req: Request, res: Response) => {
  const { phone, countryCode } = req.body;
  const user = await userRepository.findByPhone(phone);
  if (!user) throw ApiError.notFound("Phone number not found");

  const otp = generateOTP();
  await userRepository.updateOne(
    { phone },
    {
      $set: { otp: hashOTP(otp), otpExpiry: new Date(Date.now() + OTP_TTL_MS) },
    },
  );

  // Same signed token as the email flow, delivered as a reset link in the SMS.
  const resetToken = signToken(
    { userId: user._id!.toString(), email: user.email },
    "10m",
  );

  await sendSMS(
    `${countryCode}${phone}`,
    `Your OTP is: ${otp}. Reset your password: ${resetPasswordUrl(resetToken)}`,
  );
  sendResponse(res, HTTP_STATUS.OK, "OTP sent to phone");
});

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, otp, newPassword } = req.body;

    // The signed token identifies the user (no email/phone needed). It throws
    // if tampered or past its 10-minute expiry.
    let userId: string;
    try {
      userId = verifyToken(token).userId;
    } catch {
      throw ApiError.badRequest("Invalid or expired reset link");
    }

    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    if (
      hashOTP(otp) !== user.otp ||
      !user.otpExpiry ||
      new Date() > user.otpExpiry
    )
      throw ApiError.badRequest("Invalid or expired OTP");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { otp: "", otpExpiry: "" },
      },
    );
    sendResponse(res, HTTP_STATUS.OK, "Password reset successfully");
  },
);
