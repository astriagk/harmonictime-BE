/**
 * One-off migration: Blogs.Content (single HTML string) -> Blogs.Sections[].
 *
 * The article body used to be one sanitised HTML blob with images inline. It is
 * now an ordered array of { Heading?, Content, Image?, Caption? } so each
 * picture sits with the copy it illustrates, and the body whitelist no longer
 * permits <img>. Posts written before the change would render empty on the new
 * frontend, so their Content is folded into a single section here.
 *
 * Any <img> found in the old body is hoisted to Sections[0].Image rather than
 * dropped — the first one wins, since a legacy body has no structure telling us
 * which paragraph each later image belonged to. The old `Content` and
 * `BannerImage` fields are then removed.
 *
 * Idempotent: only documents that still have `Content` and no `Sections` are
 * touched, so re-running is a no-op.
 *
 * Run:  npm run migrate:blog-sections
 */
import { connectDB, getDB } from "../shared/config/database";
import { COLLECTIONS } from "../shared/constants/collections";
import { sanitizeHtml, stripHtml } from "../shared/utils/sanitizeHtml";
import logger from "../shared/utils/logger";

const firstImageSrc = (html: string): string | undefined => {
  const match = /<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  const src = match?.[2] ?? match?.[3] ?? match?.[4];
  return src && /^(https?:)?\/\//i.test(src) ? src : undefined;
};

const migrate = async (): Promise<void> => {
  await connectDB();
  const collection = getDB().collection(COLLECTIONS.BLOGS);

  const legacy = await collection
    .find({ Content: { $type: "string" }, Sections: { $exists: false } })
    .toArray();

  if (!legacy.length) {
    logger.info("No legacy blog posts to migrate");
    return;
  }

  let migrated = 0;
  for (const post of legacy) {
    const rawContent = post.Content as string;
    const Content = sanitizeHtml(rawContent);

    // A body that sanitises to nothing (e.g. it was a lone image) would fail
    // the new "min 1 section" rule, so fall back to the excerpt.
    const body = stripHtml(Content)
      ? Content
      : `<p>${stripHtml(post.Excerpt ?? "") || post.Title}</p>`;

    const Image = firstImageSrc(rawContent) ?? (post.BannerImage as string | undefined);

    await collection.updateOne(
      { _id: post._id },
      {
        $set: {
          Sections: [{ Content: body, ...(Image ? { Image } : {}) }],
          UpdatedAt: new Date(),
        },
        $unset: { Content: "", BannerImage: "" },
      }
    );
    migrated += 1;
    logger.info(`Migrated blog post: ${post.Slug ?? post._id}`);
  }

  logger.info(`Migrated ${migrated} blog post(s) to Sections[]`);
};

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Blog section migration failed: ${err?.message || err}`);
    process.exit(1);
  });
