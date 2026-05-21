import Joi from "joi";

export const createDialColorSchema = Joi.object({
  DialColorID: Joi.string().optional(),
  DialColorName: Joi.string().required(),
});

export const updateDialColorSchema = Joi.object({
  DialColorName: Joi.string().required(),
});
