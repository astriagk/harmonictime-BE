import Joi from "joi";

export const createDeliveryReturnSchema = Joi.object({
  ProductID: Joi.string().required(),
  DeliveryInformation: Joi.string().allow("").optional(),
  ReturnsPolicy: Joi.string().allow("").optional(),
});

export const updateDeliveryReturnSchema = Joi.object({
  DeliveryInformation: Joi.string().allow("").optional(),
  ReturnsPolicy: Joi.string().allow("").optional(),
}).min(1);
