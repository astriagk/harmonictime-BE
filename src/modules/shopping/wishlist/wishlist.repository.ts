import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { WishlistItem } from "./wishlist.types";

class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor() {
    super(COLLECTIONS.WISHLIST);
  }

  findByUserAndProduct(userId: ObjectId, productId: ObjectId) {
    return this.findOne({ UserID: userId, ProductID: productId });
  }

  findByUser(userId: string | ObjectId) {
    return this.find({ UserID: this.toObjectId(userId) });
  }
}

export const wishlistRepository = new WishlistRepository();
