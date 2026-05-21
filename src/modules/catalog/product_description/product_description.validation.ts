import Joi from "joi";

export const createProductDescriptionSchema = Joi.object({
  ProductID: Joi.string().required(),
  Title: Joi.string().allow("").optional(),
  Content: Joi.string().allow("").optional(),
  AdditionalDetails: Joi.string().allow("").optional(),
});

export const updateProductDescriptionSchema = Joi.object({
  Title: Joi.string().allow("").optional(),
  Content: Joi.string().allow("").optional(),
  AdditionalDetails: Joi.string().allow("").optional(),
}).min(1);
