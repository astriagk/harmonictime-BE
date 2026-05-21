import Joi from "joi";

export const createRoleSchema = Joi.object({
  RoleID: Joi.number().required(),
  RoleName: Joi.string().required(),
});

export const createUserRoleSchema = Joi.object({
  UserRoleID: Joi.number().required(),
  UserID: Joi.string().required(),
  RoleID: Joi.number().required(),
});
