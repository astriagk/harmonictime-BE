import Joi from "joi";

export const createCategorySchema = Joi.object({
  CategoryID: Joi.string().optional(),
  CategoryName: Joi.string().required(),
});

export const updateCategorySchema = Joi.object({
  CategoryName: Joi.string().required(),
});
