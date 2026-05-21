import Joi from "joi";

export const createCheckoutSchema = Joi.object({
  UserID: Joi.string().required(),
  AddressID: Joi.string().required(),
  TotalAmount: Joi.number().required(),
  PaymentStatus: Joi.string().required(),
  DeliveryStatus: Joi.string().required(),
  CheckoutDate: Joi.date().required(),
  ProductIDs: Joi.array().items(Joi.string()).min(1).required(),
});

export const updateCheckoutStatusSchema = Joi.object({
  PaymentStatus: Joi.string().optional(),
  DeliveryStatus: Joi.string().optional(),
}).min(1);
