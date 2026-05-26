import Joi from "joi";

export const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  profilePicUrl: Joi.string().uri().optional(),
}).min(1);
