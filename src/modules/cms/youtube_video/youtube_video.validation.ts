import Joi from "joi";

export const createYoutubeVideoSchema = Joi.object({
  Title: Joi.string().trim().min(3).max(200).required(),
  YoutubeUrl: Joi.string().trim().uri().required(),
  Thumbnail: Joi.string().trim().uri({ allowRelative: true }).allow("", null),
  Author: Joi.string().trim().max(120).required(),
  Order: Joi.number().integer().min(0),
  Status: Joi.string().valid("draft", "published", "archived").default("draft"),
  PublishedAt: Joi.date().iso().required(),
});

export const updateYoutubeVideoSchema = Joi.object({
  Title: Joi.string().trim().min(3).max(200),
  YoutubeUrl: Joi.string().trim().uri(),
  Thumbnail: Joi.string().trim().uri({ allowRelative: true }).allow("", null),
  Author: Joi.string().trim().max(120).required(),
  Order: Joi.number().integer().min(0),
  Status: Joi.string().valid("draft", "published", "archived"),
  PublishedAt: Joi.date().iso().required(),
}).min(1);
