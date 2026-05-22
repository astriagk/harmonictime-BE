import Joi from "joi";

// The inner `data` JSON is never inspected — its shape differs per type and may
// change freely. We only ensure a record is queryable: `type` present and some
// `data` supplied. `data` is accepted verbatim (object or array, any nesting).
export const createSiteContentSchema = Joi.object({
  type: Joi.string().trim().required(),
  data: Joi.alternatives(Joi.object(), Joi.array()).required(),
  order: Joi.number().optional(),
  isActive: Joi.boolean().default(true),
});

export const updateSiteContentSchema = Joi.object({
  type: Joi.string().trim(),
  data: Joi.alternatives(Joi.object(), Joi.array()),
  order: Joi.number(),
  isActive: Joi.boolean(),
}).min(1);
