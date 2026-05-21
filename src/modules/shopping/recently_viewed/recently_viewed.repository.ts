import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { RecentlyViewed } from "./recently_viewed.types";

class RecentlyViewedRepository extends BaseRepository<RecentlyViewed> {
  constructor() {
    super(COLLECTIONS.RECENTLY_VIEWED);
  }

  findByUserSorted(userId: string | ObjectId) {
    return this.collection
      .find({ UserID: this.toObjectId(userId) })
      .sort({ ViewedAt: -1 })
      .toArray();
  }
}

export const recentlyViewedRepository = new RecentlyViewedRepository();
