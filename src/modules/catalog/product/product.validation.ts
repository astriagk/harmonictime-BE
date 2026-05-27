import Joi from "joi";

export const createProductSchema = Joi.object({
  UserID: Joi.string().required(),
  ProductName: Joi.string().required(),
  BrandID: Joi.string().required(),
  CollectionID: Joi.string().required(),
  CategoryID: Joi.string().required(),
  RecipientID: Joi.string().required(),
  Price: Joi.number().required(),
  Quantity: Joi.number().integer().min(1).required(),
  OfferID: Joi.string().allow(null, "").optional(),
  IsPriceInclusiveOfTax: Joi.boolean().required().messages({
    "any.required": "IsPriceInclusiveOfTax is required — specify whether the price includes 18% GST",
  }),
});

export const updateAvailabilitySchema = Joi.object({
  ProductIDs: Joi.array().items(Joi.string()).min(1).required(),
});

// Bulk offer assignment. AssignProductIDs get the given OfferID; RemoveProductIDs
// have their offer cleared. At least one of the two arrays is required, so a
// single request can assign, remove, or do both at once. OfferID is required
// only when assigning (validated in the controller against a real offer).
export const bulkOfferSchema = Joi.object({
  OfferID: Joi.string().allow(null, ""),
  AssignProductIDs: Joi.array().items(Joi.string()).min(1),
  RemoveProductIDs: Joi.array().items(Joi.string()).min(1),
}).or("AssignProductIDs", "RemoveProductIDs");

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
  Quantity: Joi.number().integer().min(0),
  OfferID: Joi.string().allow(null, ""),
  IsAvailable: Joi.boolean(),
  IsPriceInclusiveOfTax: Joi.boolean(),
  RemovedImageIDs: Joi.array().items(Joi.string()),
}).min(1);
