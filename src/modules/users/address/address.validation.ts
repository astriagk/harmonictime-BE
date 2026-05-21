import Joi from "joi";

export const createAddressSchema = Joi.object({
  UserID: Joi.string().required(),
  Country: Joi.string().required(),
  FirstName: Joi.string().required(),
  LastName: Joi.string().required(),
  AddressLine1: Joi.string().required(),
  AddressLine2: Joi.string().allow("").optional(),
  City: Joi.string().required(),
  State: Joi.string().required(),
  PostalCode: Joi.string().required(),
  Phone: Joi.string().required(),
  orderNotes: Joi.string().allow("").optional(),
  IsDefault: Joi.boolean().optional(),
});

export const updateAddressSchema = Joi.object({
  Country: Joi.string().optional(),
  FirstName: Joi.string().optional(),
  LastName: Joi.string().optional(),
  AddressLine1: Joi.string().optional(),
  AddressLine2: Joi.string().allow("").optional(),
  City: Joi.string().optional(),
  State: Joi.string().optional(),
  PostalCode: Joi.string().optional(),
  Phone: Joi.string().optional(),
  orderNotes: Joi.string().allow("").optional(),
  IsDefault: Joi.boolean().optional(),
}).min(1);
