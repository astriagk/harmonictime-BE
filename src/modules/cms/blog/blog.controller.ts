import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { sanitizeHtml, stripHtml } from "../../../shared/utils/sanitizeHtml";
import { isAdminUser } from "../../../shared/middlewares/requireAdmin.middleware";
import { blogRepository, slugify } from "./blog.repository";
import { Blog, BlogSection, BlogStatus } from "./blog.types";

const DEFAULT_LIMIT = 6; // the 3-column grid shows 6 cards per page
const MAX_LIMIT = 50;

const parsePaging = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const rawLimit = Number(req.query.limit) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit };
};

// Shared by the public list and the admin list: Category + Search narrowing.
const buildQueryFilter = (req: Request): Filter<Blog>[] => {
  const and: Filter<Blog>[] = [];
  const { Category, Search } = req.query;
  if (typeof Category === "string" && Category.trim())
    and.push(blogRepository.categoryFilter(Category));
  if (typeof Search === "string" && Search.trim())
    and.push(blogRepository.searchFilter(Search));
  return and;
};

const combine = (clauses: Filter<Blog>[]): Filter<Blog> =>
  clauses.length ? ({ $and: clauses } as Filter<Blog>) : {};

// Sanitise every section body and reduce Heading/Caption to plain text, keeping
// the array in the order it arrived — that order is the render order.
// Sections whose body is empty once sanitised are dropped: an editor that sends
// a trailing blank block should not produce a gap in the article.
const normaliseSections = (sections: BlogSection[]): BlogSection[] => {
  const cleaned = sections
    .map((section) => {
      const Content = sanitizeHtml(section.Content);
      if (!stripHtml(Content)) return null;

      const Heading = section.Heading ? stripHtml(section.Heading) : "";
      const Caption = section.Caption ? stripHtml(section.Caption) : "";

      return {
        ...(Heading ? { Heading } : {}),
        Content,
        ...(section.Image ? { Image: section.Image } : {}),
        ...(Caption ? { Caption } : {}),
      } as BlogSection;
    })
    .filter((section): section is BlogSection => section !== null);

  if (!cleaned.length)
    throw ApiError.badRequest("Sections are empty after sanitisation");

  return cleaned;
};

const objectIdParam = (id: string): ObjectId => {
  if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid blog id");
  return new ObjectId(id);
};

// GET /api/blogs — paginated published posts for the 3-column grid.
export const listBlogs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaging(req);
  const filter = combine([blogRepository.publishedFilter(), ...buildQueryFilter(req)]);
  const result = await blogRepository.paginateCards(filter, page, limit);
  sendResponse(res, HTTP_STATUS.OK, "Blogs retrieved successfully", result);
});

// GET /api/blogs/categories — distinct categories with post counts.
export const listBlogCategories = asyncHandler(
  async (_req: Request, res: Response) => {
    const categories = await blogRepository.listCategories();
    sendResponse(res, HTTP_STATUS.OK, "Categories retrieved successfully", categories);
  }
);

// GET /api/blogs/:slugOrId — full post for the detail page.
// An archived post answers 410 so old links can say "this article was removed"
// rather than pretending it never existed.
//
// Runs under optionalAuthMiddleware: an admin gets the post whatever its
// status, because the admin edit screen (/admin/blogs/:id/edit) loads through
// this same endpoint and must be able to open a draft. For everyone else the
// status rules below apply unchanged — an anonymous request cannot tell a draft
// from a post that never existed.
export const getBlog = asyncHandler(async (req: Request, res: Response) => {
  const { slugOrId } = req.params;
  const post = await blogRepository.findPublishedBySlugOrId(slugOrId);
  if (post) {
    sendResponse(res, HTTP_STATUS.OK, "Blog retrieved successfully", post);
    return;
  }

  const existing = await blogRepository.findAnyBySlugOrId(slugOrId);

  if (existing && (await isAdminUser(req.user?.userId))) {
    sendResponse(res, HTTP_STATUS.OK, "Blog retrieved successfully", existing);
    return;
  }

  if (existing?.Status === "archived")
    throw new ApiError(HTTP_STATUS.GONE, "This blog post is no longer available");

  throw ApiError.notFound("Blog post not found");
});

// GET /api/blogs/:slugOrId/related — up to 3 cards for the strip at the bottom.
export const getRelatedBlogs = asyncHandler(async (req: Request, res: Response) => {
  const post = await blogRepository.findPublishedBySlugOrId(req.params.slugOrId);
  if (!post) throw ApiError.notFound("Blog post not found");
  const related = await blogRepository.findRelated(post, 3);
  sendResponse(res, HTTP_STATUS.OK, "Related blogs retrieved successfully", related);
});

// GET /api/blogs/admin/list — admin listing, drafts and archived included.
// Registered before /:slugOrId so "admin" is never read as a slug.
export const adminListBlogs = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaging(req);
  const clauses = buildQueryFilter(req);

  const status = req.query.Status;
  if (typeof status === "string" && status) {
    const allowed: BlogStatus[] = ["draft", "published", "archived"];
    if (!allowed.includes(status as BlogStatus))
      throw ApiError.badRequest("Status must be draft, published, or archived");
    clauses.push({ Status: status } as Filter<Blog>);
  }

  const result = await blogRepository.paginateAdmin(combine(clauses), page, limit);
  sendResponse(res, HTTP_STATUS.OK, "Blogs retrieved successfully", result);
});

// POST /api/blogs — admin only.
export const createBlog = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const now = new Date();

  const Sections = normaliseSections(body.Sections);
  const Slug = await blogRepository.generateUniqueSlug(body.Slug || body.Title);
  const Status: BlogStatus = body.Status ?? "draft";

  const doc: Blog = {
    _id: new ObjectId(),
    Slug,
    Title: body.Title,
    Excerpt: stripHtml(body.Excerpt),
    Sections,
    Image: body.Image,
    Author: body.Author,
    Category: body.Category,
    CategorySlug: slugify(body.Category),
    Tags: body.Tags ?? [],
    Status,
    // A published post always carries a date; a draft only gets one when the
    // author explicitly scheduled it.
    PublishedAt:
      Status === "published"
        ? body.PublishedAt
          ? new Date(body.PublishedAt)
          : now
        : body.PublishedAt
        ? new Date(body.PublishedAt)
        : null,
    CreatedAt: now,
    UpdatedAt: now,
    ...(body.Seo ? { Seo: body.Seo } : {}),
  };

  await blogRepository.insertOne(doc);
  sendResponse(res, HTTP_STATUS.CREATED, "Blog created successfully", doc);
});

// PUT /api/blogs/:id — admin only. Every field optional.
export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req.params.id);
  const existing = await blogRepository.findById(id);
  if (!existing) throw ApiError.notFound("Blog post not found");

  const body = req.body;
  const update: Partial<Blog> = { UpdatedAt: new Date() };

  if (body.Title !== undefined) update.Title = body.Title;
  if (body.Excerpt !== undefined) update.Excerpt = stripHtml(body.Excerpt);
  if (body.Image !== undefined) update.Image = body.Image;
  if (body.Author !== undefined) update.Author = body.Author;
  if (body.Tags !== undefined) update.Tags = body.Tags;
  if (body.Seo !== undefined) update.Seo = body.Seo;

  if (body.Category !== undefined) {
    update.Category = body.Category;
    update.CategorySlug = slugify(body.Category);
  }

  if (body.Sections !== undefined)
    update.Sections = normaliseSections(body.Sections);

  // Only regenerate the slug when explicitly asked. Renaming a title must not
  // silently break the live URL.
  if (body.Slug !== undefined)
    update.Slug = await blogRepository.generateUniqueSlug(body.Slug, id);

  if (body.PublishedAt !== undefined)
    update.PublishedAt = body.PublishedAt ? new Date(body.PublishedAt) : null;

  if (body.Status !== undefined) {
    update.Status = body.Status;
    // First transition to published without a date stamps it now.
    if (
      body.Status === "published" &&
      update.PublishedAt === undefined &&
      !existing.PublishedAt
    )
      update.PublishedAt = new Date();
  }

  await blogRepository.updateById(id, update);
  const updated = await blogRepository.findById(id);
  sendResponse(res, HTTP_STATUS.OK, "Blog updated successfully", updated);
});

// DELETE /api/blogs/:id — soft delete. `?hard=true` removes the document, for
// the rare case of a post that must genuinely disappear.
export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req.params.id);

  if (req.query.hard === "true") {
    const result = await blogRepository.deleteById(id);
    if (result.deletedCount === 0) throw ApiError.notFound("Blog post not found");
    sendResponse(res, HTTP_STATUS.OK, "Blog permanently deleted");
    return;
  }

  const result = await blogRepository.updateById(id, {
    Status: "archived",
    UpdatedAt: new Date(),
  } as Partial<Blog>);
  if (result.matchedCount === 0) throw ApiError.notFound("Blog post not found");
  sendResponse(res, HTTP_STATUS.OK, "Blog archived successfully");
});
