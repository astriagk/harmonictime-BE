import Joi from "joi";

export const addCheckoutItemSchema = Joi.object({
  CheckoutID: Joi.string().required(),
  ProductIDs: Joi.array().items(Joi.string()).min(1).required(),
  Price: Joi.number().required(),
  Quantity: Joi.number().min(1).optional(),
});

export const updateCheckoutItemSchema = Joi.object({
  Quantity: Joi.number().min(1).required(),
});
