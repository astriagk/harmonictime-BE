import Joi from "joi";

// Seller requests a payout to one of their saved bank accounts. The amount is
// derived server-side from the currently-available earnings, so it isn't taken
// from the client.
export const createWithdrawalSchema = Joi.object({
  BankAccountID: Joi.string().required(),
});

// Admin marks a withdrawal Paid after depositing the money externally.
export const payWithdrawalSchema = Joi.object({
  Reference: Joi.string().trim().required(),
  Notes: Joi.string().allow("").optional(),
});

// Admin rejects a pending withdrawal.
export const rejectWithdrawalSchema = Joi.object({
  Notes: Joi.string().trim().required(),
});
