import Joi from "joi";

export const createCollectionSchema = Joi.object({
  CollectionID: Joi.string().optional(),
  BrandID: Joi.string().required(),
  CollectionName: Joi.string().required(),
});

export const updateCollectionSchema = Joi.object({
  BrandID: Joi.string().optional(),
  CollectionName: Joi.string().optional(),
}).min(1);
