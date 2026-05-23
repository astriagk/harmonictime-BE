import Joi from "joi";

export const createProductSchema = Joi.object({
  UserID: Joi.string().required(),
  ProductName: Joi.string().required(),
  BrandID: Joi.string().required(),
  CollectionID: Joi.string().required(),
  CategoryID: Joi.string().required(),
  RecipientID: Joi.string().required(),
  Price: Joi.number().required(),
});

export const updateAvailabilitySchema = Joi.object({
  ProductIDs: Joi.array().items(Joi.string()).min(1).required(),
});

// Edit core product fields. Every field optional, but at least one required.
// RemovedImageIDs lets the edit screen report images the user deleted; each is
// removed from S3 and the DB.
export const updateProductSchema = Joi.object({
  ProductName: Joi.string(),
  BrandID: Joi.string(),
  CollectionID: Joi.string(),
  CategoryID: Joi.string(),
  RecipientID: Joi.string(),
  Price: Joi.number(),
  IsAvailable: Joi.boolean(),
  RemovedImageIDs: Joi.array().items(Joi.string()),
}).min(1);
