import Joi from "joi";

export const createBrandSchema = Joi.object({
  BrandName: Joi.string().required(),
});

export const createMultipleBrandsSchema = Joi.object({
  watchBrands: Joi.array()
    .items(Joi.object({ BrandName: Joi.string().required() }).unknown(true))
    .min(1)
    .required(),
});

export const updateBrandSchema = Joi.object({
  BrandName: Joi.string().required(),
});
