import Joi from "joi";

export const createOfferSchema = Joi.object({
  OfferName: Joi.string().required(),
  Description: Joi.string().allow("").optional(),
  DiscountPercentage: Joi.number().required(),
  StartDate: Joi.date().required(),
  EndDate: Joi.date().required(),
  IsActive: Joi.boolean().optional(),
});

export const updateOfferSchema = Joi.object({
  OfferName: Joi.string().optional(),
  Description: Joi.string().allow("").optional(),
  DiscountPercentage: Joi.number().optional(),
  StartDate: Joi.date().optional(),
  EndDate: Joi.date().optional(),
  IsActive: Joi.boolean().optional(),
}).min(1);
