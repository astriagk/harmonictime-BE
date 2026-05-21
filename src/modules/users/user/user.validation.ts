import Joi from "joi";

export const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
}).min(1);
