import Joi from "joi";

export const createUserReviewSchema = Joi.object({
  ProductID: Joi.string().required(),
  Rating: Joi.number().min(1).max(5).required(),
  Subject: Joi.string().required(),
  Name: Joi.string().optional().allow(""),
  Email: Joi.string().email().required(),
  Comment: Joi.string().required(),
});
