import Joi from "joi";

export const createThreadSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
});

export const sendMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required(),
});
