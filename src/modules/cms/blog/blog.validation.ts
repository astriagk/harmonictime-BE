import Joi from "joi";

const seoSchema = Joi.object({
  MetaTitle: Joi.string().trim().max(200).allow("", null),
  MetaDescription: Joi.string().trim().max(400).allow("", null),
});

// One article block. `Content` is the only required part — a section may be
// pure copy, or copy plus an illustrating image and its caption.
const sectionSchema = Joi.object({
  Heading: Joi.string().trim().max(200).allow("", null),
  Content: Joi.string().min(10).required(),
  Image: Joi.string().trim().uri({ allowRelative: true }).allow("", null),
  Caption: Joi.string().trim().max(200).allow("", null),
});

// Array order is render order, so it is stored exactly as sent — never sorted.
const sectionsSchema = Joi.array().items(sectionSchema).min(1);

// Slug is optional on create — derived from Title when omitted. When supplied
// it is still normalised server-side, so a human-typed value is fine.
export const createBlogSchema = Joi.object({
  Title: Joi.string().trim().min(3).max(200).required(),
  Slug: Joi.string().trim().max(120).allow("", null),
  Excerpt: Joi.string().trim().min(10).max(400).required(),
  Sections: sectionsSchema.required(),
  Image: Joi.string().trim().uri({ allowRelative: true }).required(),
  Author: Joi.string().trim().max(120).required(),
  Category: Joi.string().trim().max(120).required(),
  Tags: Joi.array().items(Joi.string().trim().max(50)).default([]),
  Status: Joi.string().valid("draft", "published", "archived").default("draft"),
  PublishedAt: Joi.date().iso().allow(null),
  Seo: seoSchema,
});

export const updateBlogSchema = Joi.object({
  Title: Joi.string().trim().min(3).max(200),
  Slug: Joi.string().trim().max(120),
  Excerpt: Joi.string().trim().min(10).max(400),
  // Sections are replaced wholesale, never patched element-by-element: the
  // editor always holds the whole article, and a partial merge would make the
  // resulting order ambiguous.
  Sections: sectionsSchema,
  Image: Joi.string().trim().uri({ allowRelative: true }),
  Author: Joi.string().trim().max(120),
  Category: Joi.string().trim().max(120),
  Tags: Joi.array().items(Joi.string().trim().max(50)),
  Status: Joi.string().valid("draft", "published", "archived"),
  PublishedAt: Joi.date().iso().allow(null),
  Seo: seoSchema,
}).min(1);
