import Joi from "joi";

export const addRecentlyViewedSchema = Joi.object({
  UserID: Joi.string().required(),
  ProductID: Joi.string().required(),
  ViewedAt: Joi.date().optional(),
});
