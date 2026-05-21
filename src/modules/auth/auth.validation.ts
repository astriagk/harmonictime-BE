import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().optional(),
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
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  otp: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
}).or("email", "phone");
