import Joi from "joi";

export const createProductImageSchema = Joi.object({
  ProductID: Joi.string().required(),
  ImageURLs: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().required(),
        key: Joi.string().allow("").optional(),
        IsPrimary: Joi.boolean().optional(),
      })
    )
    .min(1)
    .required(),
  AltText: Joi.string().allow("").optional(),
});

export const updateProductImageSchema = Joi.object({
  ImageURL: Joi.string().optional(),
  key: Joi.string().allow("").optional(),
  IsPrimary: Joi.boolean().optional(),
  AltText: Joi.string().allow("").optional(),
}).min(1);
