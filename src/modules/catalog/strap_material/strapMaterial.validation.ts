import Joi from "joi";

export const createStrapMaterialSchema = Joi.object({
  StrapMaterialID: Joi.string().optional(),
  StrapMaterialName: Joi.string().required(),
});

export const updateStrapMaterialSchema = Joi.object({
  StrapMaterialName: Joi.string().required(),
});
