import Joi from "joi";

const optionalId = Joi.string().allow("", null).optional();

export const createProductDetailsSchema = Joi.object({
  ProductID: Joi.string().required(),
  DialColorID: optionalId,
  MovementID: optionalId,
  StrapMaterialID: optionalId,
  CaseMaterialID: optionalId,
  WatchMarkersID: optionalId,
  DeliveryOptionID: optionalId,
  Diameter: Joi.string().allow("").optional(),
  WaterResistant: Joi.string().allow("").optional(),
  ManufacturerProductNumber: Joi.string().allow("").optional(),
  Guarantee: Joi.string().allow("").optional(),
});

export const updateProductDetailsSchema = createProductDetailsSchema
  .fork(["ProductID"], (s) => s.optional())
  .min(1);
