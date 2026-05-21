import Joi from "joi";

export const createCaseMaterialSchema = Joi.object({
  CaseMaterialID: Joi.string().optional(),
  CaseMaterialName: Joi.string().required(),
});

export const updateCaseMaterialSchema = Joi.object({
  CaseMaterialName: Joi.string().required(),
});
