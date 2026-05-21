import Joi from "joi";

export const createMovementSchema = Joi.object({
  MovementID: Joi.string().optional(),
  MovementName: Joi.string().required(),
});

export const updateMovementSchema = Joi.object({
  MovementName: Joi.string().required(),
});
