import { ObjectId } from "mongodb";

// `archived` is the soft-delete state: the document stays so old URLs can be
// answered with 410 Gone instead of a bare 404.
export type BlogStatus = "draft" | "published" | "archived";

export interface BlogSeo {
  MetaTitle?: string;
  MetaDescription?: string;
}

// One block of the article body. Text first, optional picture under it — the
// pairing is the point: an image lives with the copy it illustrates rather
// than floating inside one long HTML blob.
export interface BlogSection {
  Heading?: string; // plain text sub-heading above the copy
  Content: string; // sanitised HTML (ARTICLE_TAGS — no <img>)
  Image?: string; // full-width image rendered under the copy
  Caption?: string; // plain text caption under the image
}

export interface Blog {
  _id?: ObjectId;
  Slug: string; // unique, URL segment for the detail route
  Title: string;
  Excerpt: string; // plain text teaser rendered on the grid card
  Sections: BlogSection[]; // article body, in render order — never reordered
  Image: string; // cover: the grid thumbnail (~370x250) and the article hero
  Author: string;
  Category: string; // display label, e.g. "Buying Guides"
  CategorySlug: string; // derived from Category so ?Category= accepts either
  Tags?: string[];
  Status: BlogStatus;
  PublishedAt: Date | null; // null while a draft has never been published
  CreatedAt: Date;
  UpdatedAt: Date;
  Seo?: BlogSeo;
}

// Grid-card shape — every field the 3-column card renders, nothing else.
export interface BlogCard {
  _id: ObjectId;
  Slug: string;
  Title: string;
  Excerpt: string;
  Image: string;
  Author: string;
  Category: string;
  PublishedAt: Date | null;
}

export interface BlogListResult {
  items: BlogCard[];
  total: number;
  page: number;
  limit: number;
}
