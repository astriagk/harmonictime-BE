import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().optional(),
  acceptedTerms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must accept the terms and conditions",
    "any.required": "acceptedTerms is required",
  }),
  accountType: Joi.string()
    .valid("individual", "business")
    .required()
    .messages({
      "any.only": "accountType must be 'individual' or 'business'",
      "any.required": "accountType is required",
    }),
  redirectAfterVerification: Joi.string().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const verifyPhoneSchema = Joi.object({
  phone: Joi.string().required(),
  countryCode: Joi.string().required(),
});

export const resetPasswordSchema = Joi.object({
  // Signed token from the reset link — identifies the user (replaces email/phone).
  token: Joi.string().required(),
  otp: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const verifyTokenSchema = Joi.object({
  token: Joi.string().required(),
  refreshToken: Joi.string().optional(),
});

export const confirmEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const updateUnverifiedEmailSchema = Joi.object({
  currentEmail: Joi.string().email().required(),
  newEmail: Joi.string().email().required(),
});

export const sendMobileOTPSchema = Joi.object({
  phone: Joi.string().required(),
  countryCode: Joi.string().required(),
});

export const verifyMobileOTPSchema = Joi.object({
  phone: Joi.string().required(),
  countryCode: Joi.string().required(),
  otp: Joi.string().required(),
});
