import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { DEFAULT_ROLE_ID, RoleId } from "../../shared/constants/roles";
import jwt from "jsonwebtoken";
import {
  signToken,
  signRefreshToken,
  verifyToken as verifyAccessToken,
  verifyRefreshToken,
} from "../../shared/services/token.service";
import {
  resetPasswordUrl,
  FRONTEND_ROUTES,
} from "../../shared/constants/frontend";
import { verifyGoogleIdToken } from "../../shared/services/google-auth.service";
import { sendTemplateEmail } from "../../shared/services/email.service";
import {
  sendPasswordResetSMS,
  sendMobileOTP as sendMobileOTPService,
} from "../../shared/services/sms.service";
import {
  welcomeEmail,
  passwordResetOtpEmail,
  verifyEmailTemplate,
} from "../../shared/email-templates";
import { generateOTP, hashOTP } from "../../shared/utils/otp";
import logger from "../../shared/utils/logger";
import { ObjectId } from "mongodb";
import { userRepository } from "../users/user/user.repository";
import { userRoleRepository } from "../users/role/role.repository";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const generateEmailVerificationToken = (): { raw: string; hashed: string } => {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
};

const OTP_TTL_MS = 10 * 60 * 1000;

// Formats phone + countryCode into an E.164 string (+{cc}{number}). Strips a
// leading 0 and any spaces/dashes — SNS rejects anything that isn't strict E.164.
const toE164 = (phone: string, countryCode: string): string =>
  `+${countryCode.replace(/^\+/, "")}${phone.replace(/[\s-]/g, "").replace(/^0+/, "")}`;

export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    phone,
    acceptedTerms,
    accountType,
    businessName,
    redirectAfterVerification,
  } = req.body;

  const existing = await userRepository.findByEmail(email);
  if (existing) throw ApiError.conflict("Email already exists");

  const { raw: rawToken, hashed: hashedToken } =
    generateEmailVerificationToken();

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await userRepository.insertOne({
    email,
    password: hashedPassword,
    phone,
    acceptedTerms,
    termsAcceptedAt: new Date(),
    dateCreated: new Date(),
    accountType: accountType ?? "individual",
    ...(accountType === "business" && businessName ? { businessName } : {}),
    isEmailVerified: false,
    isPhoneVerified: false,
    emailVerificationToken: hashedToken,
    emailVerificationTokenExpiry: new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    ),
    ...(redirectAfterVerification ? { postVerificationRedirect: redirectAfterVerification } : {}),
  });

  const assignedRole =
    accountType === "business" ? RoleId.SELLER : DEFAULT_ROLE_ID;
  await userRoleRepository.insertOne({
    UserRoleID: assignedRole,
    UserID: result.insertedId,
    RoleID: assignedRole,
  });

  // Send verification email — best-effort and fire-and-forget so a slow/blocked
  // SMTP host never stalls the registration response. The mailer swallows its
  // own errors; users who don't receive it can use the resend-verification flow.
  void sendTemplateEmail(email, verifyEmailTemplate(rawToken, email));

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    "Registration successful. Please check your email to verify your account.",
    {
      userId: result.insertedId,
    },
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await userRepository.findByEmail(email);
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  // Google-created accounts carry no password hash. bcrypt.compare would throw
  // on an undefined hash (a 500), so short-circuit with a message the UI can
  // act on. This does reveal that the address exists as a Google account —
  // acceptable, since register() already leaks existence via its 409, and the
  // alternative leaves the user with no way to understand why login fails.
  if (!user.password)
    throw ApiError.badRequest(
      "This account was created with Google. Continue with Google, or use “Forgot password” to set a password.",
    );

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  if (!user.isEmailVerified) {
    return sendResponse(
      res,
      HTTP_STATUS.FORBIDDEN,
      "Please verify your email address before logging in. Check your inbox for the verification link.",
      {
        emailVerified: false,
      },
    );
  }

  const token = signToken({ userId: user._id!.toString(), email: user.email });
  const refreshToken = signRefreshToken({
    userId: user._id!.toString(),
    email: user.email,
  });

  await userRepository.updateOne(
    { _id: user._id },
    { $set: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) } },
  );

  sendResponse(res, HTTP_STATUS.OK, "Login successful", {
    token,
    refreshToken,
  });
});

// Google Sign-In, ID-token flow. The frontend obtains an ID token from Google
// Identity Services and posts it here; we verify it and mint our own JWTs, so
// everything downstream (authMiddleware, role checks, /verify-token) is
// unchanged. Identity is keyed on the Google `sub`, not the email — `sub` is
// stable, whereas an email can be changed on the Google side.
export const googleSignIn = asyncHandler(
  async (req: Request, res: Response) => {
    const { idToken } = req.body;

    const profile = await verifyGoogleIdToken(idToken);

    // Google's own verification of the address is what makes linking-by-email
    // safe. Without it, a token claiming an arbitrary address would be an
    // account-takeover primitive.
    if (!profile.emailVerified) {
      return sendResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Your Google account email is not verified. Verify it with Google and try again.",
        { emailVerified: false },
      );
    }

    let user =
      (await userRepository.findByGoogleId(profile.googleId)) ??
      (await userRepository.findByEmailInsensitive(profile.email));

    let isNewUser = false;
    // True when an existing password account gained Google as a second sign-in
    // method on this request.
    const linked = !!user && !user.googleId;

    if (!user) {
      try {
        const result = await userRepository.insertOne({
          email: profile.email,
          googleId: profile.googleId,
          authProvider: "google",
          ...(profile.name ? { displayName: profile.name } : {}),
          ...(profile.picture ? { profilePicUrl: profile.picture } : {}),
          acceptedTerms: true,
          termsAcceptedAt: new Date(),
          dateCreated: new Date(),
          accountType: "individual",
          status: "active",
          isEmailVerified: true, // Google asserted email_verified
          isPhoneVerified: false,
          // No `password` key at all — not null, not "".
        });
        user = await userRepository.findById(result.insertedId);
        isNewUser = true;
      } catch (err: any) {
        // Two concurrent first-time sign-ins race here; the unique email index
        // turns the loser into E11000. Re-read and fall through to the link
        // path rather than 500-ing.
        if (err?.code !== 11000) throw err;
        user = await userRepository.findByEmailInsensitive(profile.email);
      }
    }

    if (!user)
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Could not complete Google sign-in",
      );

    if (user.status === "blocked") {
      return sendResponse(res, HTTP_STATUS.FORBIDDEN, "Account blocked", {
        blocked: true,
        suspended: false,
      });
    }
    if (user.status === "suspended") {
      return sendResponse(res, HTTP_STATUS.FORBIDDEN, "Account suspended", {
        blocked: false,
        suspended: true,
      });
    }

    const accessToken = signToken({
      userId: user._id!.toString(),
      email: user.email,
    });
    const refreshToken = signRefreshToken({
      userId: user._id!.toString(),
      email: user.email,
    });

    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: {
          refreshTokenHash: await bcrypt.hash(refreshToken, 10),
          googleId: profile.googleId,
          // Google verified the address, so a half-finished local signup is
          // completed here — that is the point of linking.
          isEmailVerified: true,
          // Backfill only; never overwrite what the user set themselves.
          ...(!user.profilePicUrl && profile.picture
            ? { profilePicUrl: profile.picture }
            : {}),
          ...(!user.displayName && profile.name
            ? { displayName: profile.name }
            : {}),
        },
        // Any pending email-verification link is now meaningless.
        $unset: {
          emailVerificationToken: "",
          emailVerificationTokenExpiry: "",
        },
      },
    );

    // Role assignment is self-healing: register() inserts the UserRoles row
    // after the user insert with no transaction, so orphaned users are already
    // possible. Idempotent by design.
    let roles = await userRoleRepository.findByUser(user._id!.toString());
    if (roles.length === 0) {
      await userRoleRepository.insertOne({
        UserRoleID: DEFAULT_ROLE_ID,
        UserID: user._id!,
        RoleID: DEFAULT_ROLE_ID,
      });
      roles = await userRoleRepository.findByUser(user._id!.toString());
    }

    // Fire-and-forget, same as register(). No verification email — Google
    // already proved the address.
    if (isNewUser) void sendTemplateEmail(user.email, welcomeEmail());

    // Google sign-in always lands on the products page, business or not — GST
    // onboarding belongs to the email-verification flow, not here.
    const redirectTo =
      user.postVerificationRedirect ??
      FRONTEND_ROUTES.POST_VERIFICATION_INDIVIDUAL;

    sendResponse(res, HTTP_STATUS.OK, "Signed in with Google", {
      token: accessToken,
      refreshToken,
      userId: user._id,
      email: user.email,
      accountType: user.accountType,
      roles: roles.map((r) => r.RoleID),
      redirectTo,
      isNewUser,
      linked,
    });
  },
);

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

  await sendPasswordResetSMS(
    toE164(phone, countryCode),
    otp,
    resetPasswordUrl(resetToken),
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
      userId = verifyAccessToken(token).userId;
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

export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
  const { token, refreshToken: providedRefreshToken } = req.body;

  type DecodedPayload = { userId: string; email: string; exp?: number };

  // --- 1. Try to verify the access token ---
  let payload: DecodedPayload | null = null;
  let isExpired = false;

  try {
    payload = verifyAccessToken(token) as DecodedPayload;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      isExpired = true;
      payload = jwt.decode(token) as DecodedPayload | null;
    } else {
      return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Invalid token", {
        valid: false,
        reason: "invalid",
      });
    }
  }

  if (!payload?.userId) {
    return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Invalid token", {
      valid: false,
      reason: "invalid",
    });
  }

  const user = await userRepository.findById(payload.userId);
  if (!user) {
    return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "User not found", {
      valid: false,
      reason: "invalid",
    });
  }

  const roles = await userRoleRepository.findByUser(payload.userId);

  // --- 2. Token is valid ---
  if (!isExpired) {
    return sendResponse(res, HTTP_STATUS.OK, "Token is valid", {
      valid: true,
      userId: user._id,
      email: user.email,
      accountType: (user as any).accountType,
      roles: roles.map((r) => r.RoleID),
      expiresAt: payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : null,
    });
  }

  // --- 3. Token is expired — try refresh token if provided ---
  if (!providedRefreshToken) {
    return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Token has expired", {
      valid: false,
      expired: true,
      reason: "expired",
    });
  }

  let refreshPayload: { userId: string; email: string } | null = null;
  try {
    refreshPayload = verifyRefreshToken(providedRefreshToken);
  } catch {
    return sendResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Refresh token is invalid",
      {
        valid: false,
        expired: true,
        reason: "refresh_invalid",
      },
    );
  }

  if (refreshPayload.userId !== payload.userId) {
    return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Token mismatch", {
      valid: false,
      expired: true,
      reason: "refresh_invalid",
    });
  }

  const refreshUser = await userRepository.findById(refreshPayload.userId);
  if (!refreshUser?.refreshTokenHash) {
    return sendResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Session expired. Please login again.",
      {
        valid: false,
        expired: true,
        reason: "session_expired",
      },
    );
  }

  const hashValid = await bcrypt.compare(
    providedRefreshToken,
    refreshUser.refreshTokenHash,
  );
  if (!hashValid) {
    return sendResponse(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      "Session expired. Please login again.",
      {
        valid: false,
        expired: true,
        reason: "session_expired",
      },
    );
  }

  const newAccessToken = signToken({
    userId: refreshUser._id!.toString(),
    email: refreshUser.email,
  });

  return sendResponse(res, HTTP_STATUS.OK, "Token refreshed successfully", {
    valid: false,
    expired: true,
    refreshed: true,
    newToken: newAccessToken,
    userId: refreshUser._id,
    email: refreshUser.email,
    accountType: (refreshUser as any).accountType,
    roles: roles.map((r) => r.RoleID),
  });
});

export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken: token } = req.body;

    let payload: { userId: string; email: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || !user.refreshTokenHash)
      throw ApiError.unauthorized("Invalid or expired refresh token");

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) throw ApiError.unauthorized("Invalid or expired refresh token");

    const newAccessToken = signToken({
      userId: user._id!.toString(),
      email: user.email,
    });
    sendResponse(res, HTTP_STATUS.OK, "Token refreshed successfully", {
      token: newAccessToken,
    });
  },
);

export const confirmEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body;

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await userRepository.findOne({
      emailVerificationToken: hashed,
    });

    if (!user)
      throw ApiError.badRequest("Invalid or expired verification link");

    if (
      !user.emailVerificationTokenExpiry ||
      new Date() > user.emailVerificationTokenExpiry
    ) {
      throw ApiError.badRequest(
        "Verification link has expired. Please request a new one.",
      );
    }

    const accessToken = signToken({
      userId: user._id!.toString(),
      email: user.email,
    });
    const refreshToken = signRefreshToken({
      userId: user._id!.toString(),
      email: user.email,
    });

    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: {
          isEmailVerified: true,
          refreshTokenHash: await bcrypt.hash(refreshToken, 10),
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationTokenExpiry: "",
          postVerificationRedirect: "",
        },
      },
    );

    const roles = await userRoleRepository.findByUser(user._id!.toString());

    const redirectTo =
      user.postVerificationRedirect ??
      (user.accountType === "business"
        ? FRONTEND_ROUTES.POST_VERIFICATION_BUSINESS
        : FRONTEND_ROUTES.POST_VERIFICATION_INDIVIDUAL);

    sendResponse(res, HTTP_STATUS.OK, "Email verified successfully", {
      token: accessToken,
      refreshToken,
      userId: user._id,
      email: user.email,
      accountType: user.accountType,
      roles: roles.map((r) => r.RoleID),
      redirectTo,
    });
  },
);

export const resendVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await userRepository.findByEmail(email);
    // Always return the same response to avoid leaking whether an email exists.
    const genericMsg =
      "If that email is registered and unverified, a new verification link has been sent.";

    if (!user || user.isEmailVerified) {
      return sendResponse(res, HTTP_STATUS.OK, genericMsg);
    }

    const { raw: rawToken, hashed: hashedToken } =
      generateEmailVerificationToken();

    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationToken: hashedToken,
          emailVerificationTokenExpiry: new Date(
            Date.now() + EMAIL_VERIFICATION_TTL_MS,
          ),
        },
      },
    );

    await sendTemplateEmail(email, verifyEmailTemplate(rawToken, email));

    sendResponse(res, HTTP_STATUS.OK, genericMsg);
  },
);

export const sendMobileOTP = asyncHandler(async (req: Request, res: Response) => {
  const { phone, countryCode } = req.body;

  const otp = generateOTP();
  await userRepository.updateOne(
    { _id: new ObjectId(req.user!.userId) },
    {
      $set: {
        otp: hashOTP(otp),
        otpExpiry: new Date(Date.now() + OTP_TTL_MS),
        otpAttempts: 0,
      },
    },
  );

  try {
    await sendMobileOTPService(toE164(phone, countryCode), otp);
  } catch (err: any) {
    // Don't leak SNS/AWS internals (account state, quotas) to the client —
    // log the detail and return something generic.
    logger.error(`SNS SMS send failed: ${err?.name}: ${err?.message}`);
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Unable to send OTP right now. Please try again shortly.",
    );
  }
  sendResponse(res, HTTP_STATUS.OK, "OTP sent to mobile number");
});

// SNS is a plain send channel — unlike Twilio Verify it does not track attempts,
// so the OTP is stored hashed on the user (same fields as the email flow) and
// checked here. Without a cap a 6-digit code is trivially brute-forceable.
const MAX_OTP_ATTEMPTS = 5;

export const verifyMobileOTP = asyncHandler(async (req: Request, res: Response) => {
  const { phone, countryCode, otp } = req.body;

  const user = await userRepository.findById(req.user!.userId);
  if (!user) throw ApiError.notFound("User not found");

  if (!user.otp || !user.otpExpiry || new Date() > user.otpExpiry)
    throw ApiError.badRequest("Invalid or expired OTP");

  if ((user.otpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    await userRepository.updateOne(
      { _id: user._id },
      { $unset: { otp: "", otpExpiry: "", otpAttempts: "" } },
    );
    throw ApiError.badRequest(
      "Too many incorrect attempts. Please request a new OTP.",
    );
  }

  if (hashOTP(otp) !== user.otp) {
    await userRepository.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
    throw ApiError.badRequest("Invalid or expired OTP");
  }

  // Persist the number that was actually verified — isPhoneVerified is
  // meaningless without it.
  await userRepository.updateOne(
    { _id: user._id },
    {
      $set: { isPhoneVerified: true, phone: toE164(phone, countryCode) },
      $unset: { otp: "", otpExpiry: "", otpAttempts: "" },
    },
  );

  sendResponse(res, HTTP_STATUS.OK, "Mobile number verified successfully", {
    verified: true,
  });
});

export const updateUnverifiedEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentEmail, newEmail } = req.body;

    const user = await userRepository.findByEmail(currentEmail);
    if (!user || user.isEmailVerified) {
      // Intentionally vague — don't reveal whether the account exists or is verified
      throw ApiError.badRequest(
        "Unable to update email. The account may not exist or is already verified.",
      );
    }

    const taken = await userRepository.findByEmail(newEmail);
    if (taken) throw ApiError.conflict("This email address is already in use.");

    const { raw: rawToken, hashed: hashedToken } =
      generateEmailVerificationToken();

    await userRepository.updateOne(
      { _id: user._id },
      {
        $set: {
          email: newEmail,
          emailVerificationToken: hashedToken,
          emailVerificationTokenExpiry: new Date(
            Date.now() + EMAIL_VERIFICATION_TTL_MS,
          ),
        },
      },
    );

    await sendTemplateEmail(newEmail, verifyEmailTemplate(rawToken, newEmail));

    sendResponse(
      res,
      HTTP_STATUS.OK,
      "Email updated. A new verification link has been sent to your new address.",
    );
  },
);
