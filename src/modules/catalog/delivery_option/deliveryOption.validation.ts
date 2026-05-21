import Joi from "joi";

export const createDeliveryOptionSchema = Joi.object({
  DeliveryOptionID: Joi.string().optional(),
  DeliveryOptionName: Joi.string().required(),
});

export const updateDeliveryOptionSchema = Joi.object({
  DeliveryOptionName: Joi.string().required(),
});
