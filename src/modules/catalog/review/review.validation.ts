import Joi from "joi";

export const createReviewSchema = Joi.object({
  ProductID: Joi.string().required(),
  Rating: Joi.number().min(1).max(5).required(),
  Name: Joi.string().required(),
  Email: Joi.string().email().required(),
  Comment: Joi.string().required(),
});
