import Joi from "joi";

export const createRecipientSchema = Joi.object({
  RecipientID: Joi.string().optional(),
  RecipientName: Joi.string().required(),
});

export const updateRecipientSchema = Joi.object({
  RecipientName: Joi.string().required(),
});
