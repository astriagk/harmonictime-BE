import Joi from "joi";

// Indian IFSC: 4 letters, a 0, then 6 alphanumerics (e.g. HDFC0001234).
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const createBankAccountSchema = Joi.object({
  AccountHolderName: Joi.string().trim().required(),
  AccountNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{6,18}$/)
    .required()
    .messages({ "string.pattern.base": "AccountNumber must be 6-18 digits" }),
  IFSC: Joi.string()
    .trim()
    .uppercase()
    .pattern(IFSC_PATTERN)
    .required()
    .messages({ "string.pattern.base": "Invalid IFSC code" }),
  BankName: Joi.string().trim().required(),
  IsDefault: Joi.boolean().optional(),
});

export const updateBankAccountSchema = Joi.object({
  AccountHolderName: Joi.string().trim(),
  AccountNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{6,18}$/)
    .messages({ "string.pattern.base": "AccountNumber must be 6-18 digits" }),
  IFSC: Joi.string()
    .trim()
    .uppercase()
    .pattern(IFSC_PATTERN)
    .messages({ "string.pattern.base": "Invalid IFSC code" }),
  BankName: Joi.string().trim(),
  IsDefault: Joi.boolean(),
}).min(1);
