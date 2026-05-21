import Joi from "joi";

export const addToCartSchema = Joi.object({
  UserID: Joi.string().required(),
  ProductID: Joi.string().required(),
  Quantity: Joi.number().min(1).optional(),
});

export const updateQuantitySchema = Joi.object({
  Quantity: Joi.number().min(1).required(),
});
