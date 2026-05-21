import Joi from "joi";

export const addToWishlistSchema = Joi.object({
  UserID: Joi.string().required(),
  ProductID: Joi.string().required(),
});
