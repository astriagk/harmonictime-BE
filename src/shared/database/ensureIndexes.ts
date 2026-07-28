import { getDB } from "../config/database";
import { COLLECTIONS } from "../constants/collections";
import logger from "../utils/logger";

// Idempotent index bootstrap, run once at startup after connectDB().
//
// Until now nothing created indexes, so Users.email uniqueness rested entirely
// on the app-level findByEmail check in register() — two concurrent signups can
// create duplicate accounts, after which findByEmail returns one of them
// non-deterministically. Google sign-in makes that worse (two concurrent
// first-time sign-ins), so the index is a prerequisite for the E11000 recovery
// path in googleSignIn.
//
// Failures are logged, never fatal: a collection that already contains
// duplicates would otherwise make the server unbootable, and that has to be
// cleaned up by hand. Check with:
//   db.Users.aggregate([{$group:{_id:{$toLower:"$email"},n:{$sum:1}}},
//                       {$match:{n:{$gt:1}}}])
export const ensureIndexes = async (): Promise<void> => {
  const db = getDB();
  try {
    await db
      .collection(COLLECTIONS.USERS)
      .createIndex({ email: 1 }, { unique: true, name: "uniq_email" });

    // Partial rather than sparse so only documents actually carrying a string
    // googleId participate — password-only accounts stay unconstrained.
    await db.collection(COLLECTIONS.USERS).createIndex(
      { googleId: 1 },
      {
        unique: true,
        name: "uniq_googleId",
        partialFilterExpression: { googleId: { $type: "string" } },
      },
    );

    logger.info("User indexes ensured");
  } catch (err: any) {
    logger.error(
      `Failed to ensure user indexes (duplicate data?): ${err?.message}`,
    );
  }
};
