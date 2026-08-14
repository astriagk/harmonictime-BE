import { Filter, ObjectId, Sort } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Blog, BlogCard, BlogListResult } from "./blog.types";

// Only the fields the grid card renders. Content/Seo/Tags are detail-only and
// would multiply the list payload for nothing.
const CARD_PROJECTION = {
  _id: 1,
  Slug: 1,
  Title: 1,
  Excerpt: 1,
  Image: 1,
  Author: 1,
  Category: 1,
  PublishedAt: 1,
} as const;

const NEWEST_FIRST: Sort = { PublishedAt: -1, _id: -1 };

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

class BlogRepository extends BaseRepository<Blog> {
  constructor() {
    super(COLLECTIONS.BLOGS);
  }

  // A post is public only once it is published AND its PublishedAt has passed,
  // so scheduling a post for later is just a matter of setting a future date.
  publishedFilter(): Filter<Blog> {
    return { Status: "published", PublishedAt: { $lte: new Date() } } as Filter<Blog>;
  }

  // `Category` accepts the display label ("Buying Guides") or the slug
  // ("buying-guides") — the frontend has no reason to know which we stored.
  categoryFilter(value: string): Filter<Blog> {
    return {
      $or: [
        { Category: { $regex: `^${escapeRegex(value.trim())}$`, $options: "i" } },
        { CategorySlug: slugify(value) },
      ],
    } as Filter<Blog>;
  }

  searchFilter(value: string): Filter<Blog> {
    const regex = { $regex: escapeRegex(value.trim()), $options: "i" };
    return { $or: [{ Title: regex }, { Excerpt: regex }] } as Filter<Blog>;
  }

  async paginateCards(
    filter: Filter<Blog>,
    page: number,
    limit: number
  ): Promise<BlogListResult> {
    const [items, total] = await Promise.all([
      this.collection
        .find(filter)
        .project<BlogCard>(CARD_PROJECTION)
        .sort(NEWEST_FIRST)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  // Admin listing keeps Status/UpdatedAt so drafts are distinguishable.
  async paginateAdmin(filter: Filter<Blog>, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.collection
        .find(filter)
        .project({ ...CARD_PROJECTION, Status: 1, UpdatedAt: 1, CreatedAt: 1 })
        .sort({ UpdatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  // The detail route param is a Slug for new links and an _id for old ones.
  private slugOrIdFilter(slugOrId: string): Filter<Blog> {
    const or: Filter<Blog>[] = [{ Slug: slugOrId } as Filter<Blog>];
    if (ObjectId.isValid(slugOrId))
      or.push({ _id: new ObjectId(slugOrId) } as unknown as Filter<Blog>);
    return { $or: or } as Filter<Blog>;
  }

  findPublishedBySlugOrId(slugOrId: string) {
    return this.collection.findOne({
      $and: [this.slugOrIdFilter(slugOrId), this.publishedFilter()],
    } as Filter<Blog>);
  }

  // Used after a published lookup misses, to tell "archived" (410) from
  // "never existed" (404).
  findAnyBySlugOrId(slugOrId: string) {
    return this.collection.findOne(this.slugOrIdFilter(slugOrId));
  }

  // Same category first, topped up with the newest other posts so the strip is
  // never half-empty on a thinly populated category.
  async findRelated(post: Blog, limit = 3): Promise<BlogCard[]> {
    const exclude = [post._id as ObjectId];

    const sameCategory = await this.collection
      .find({
        ...this.publishedFilter(),
        CategorySlug: post.CategorySlug,
        _id: { $nin: exclude },
      } as Filter<Blog>)
      .project<BlogCard>(CARD_PROJECTION)
      .sort(NEWEST_FIRST)
      .limit(limit)
      .toArray();

    if (sameCategory.length >= limit) return sameCategory;

    const fillers = await this.collection
      .find({
        ...this.publishedFilter(),
        _id: { $nin: [...exclude, ...sameCategory.map((p) => p._id)] },
      } as Filter<Blog>)
      .project<BlogCard>(CARD_PROJECTION)
      .sort(NEWEST_FIRST)
      .limit(limit - sameCategory.length)
      .toArray();

    return [...sameCategory, ...fillers];
  }

  // Distinct published categories, for a category filter UI.
  async listCategories(): Promise<{ Category: string; CategorySlug: string; Count: number }[]> {
    return this.aggregate<{ Category: string; CategorySlug: string; Count: number }>([
      { $match: this.publishedFilter() },
      {
        $group: {
          _id: "$CategorySlug",
          Category: { $first: "$Category" },
          Count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, CategorySlug: "$_id", Category: 1, Count: 1 } },
      { $sort: { Category: 1 } },
    ]);
  }

  // Slugs must stay unique — "-2", "-3" … are appended until one is free.
  async generateUniqueSlug(base: string, excludeId?: ObjectId): Promise<string> {
    const root = slugify(base) || "post";
    let candidate = root;
    let suffix = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await this.collection.findOne({
        Slug: candidate,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      } as Filter<Blog>);
      if (!clash) return candidate;
      suffix += 1;
      candidate = `${root}-${suffix}`;
    }
  }
}

export const blogRepository = new BlogRepository();
