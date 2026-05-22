import Joi from "joi";

export const createContactMessageSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().allow("").optional(),
  subject: Joi.string().trim().allow("").optional(),
  message: Joi.string().trim().required(),
});
