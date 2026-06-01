import Joi from "joi";

// Indian GSTIN: 2-digit state code + 10-char PAN + 1-digit entity number + Z + check digit
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const BUSINESS_TYPES = [
  "Proprietorship",
  "Partnership",
  "Private Limited",
  "LLP",
  "Other",
];

const DOCUMENT_TYPES = ["GSTCertificate", "AddressProof", "PANCard", "CancelledCheque", "BankStatement", "Other"];

const documentSchema = Joi.object({
  url: Joi.string().uri().required(),
  key: Joi.string().optional(),
  documentType: Joi.string().valid(...DOCUMENT_TYPES).optional(),
});

export const createGSTSchema = Joi.object({
  GSTIN: Joi.string()
    .trim()
    .uppercase()
    .pattern(GSTIN_PATTERN)
    .required()
    .messages({ "string.pattern.base": "Invalid GSTIN format" }),
  LegalBusinessName: Joi.string().trim().min(1).required(),
  TradeName: Joi.string().trim().optional(),
  BusinessType: Joi.string()
    .valid(...BUSINESS_TYPES)
    .optional(),
  RegisteredAddress: Joi.string().trim().optional(),
  State: Joi.string().trim().optional(),
  PinCode: Joi.string()
    .trim()
    .pattern(/^[0-9]{6}$/)
    .optional()
    .messages({ "string.pattern.base": "PinCode must be 6 digits" }),
  Documents: Joi.array().items(documentSchema).optional(),
});

export const updateGSTSchema = Joi.object({
  GSTIN: Joi.string()
    .trim()
    .uppercase()
    .pattern(GSTIN_PATTERN)
    .messages({ "string.pattern.base": "Invalid GSTIN format" }),
  LegalBusinessName: Joi.string().trim().min(1),
  TradeName: Joi.string().trim().allow(""),
  BusinessType: Joi.string().valid(...BUSINESS_TYPES),
  RegisteredAddress: Joi.string().trim().allow(""),
  State: Joi.string().trim().allow(""),
  PinCode: Joi.string()
    .trim()
    .pattern(/^[0-9]{6}$/)
    .allow("")
    .messages({ "string.pattern.base": "PinCode must be 6 digits" }),
  Documents: Joi.array().items(documentSchema).optional(),
}).min(1);
