import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Review } from "./review.types";

class ReviewRepository extends BaseRepository<Review> {
  constructor() {
    super(COLLECTIONS.REVIEWS);
  }

  findByProduct(productID: string | ObjectId) {
    return this.find({ ProductID: this.toObjectId(productID) });
  }

  // Average rating + total count for a single product.
  async getProductSummary(productID: string | ObjectId) {
    const [summary] = await this.aggregate<{
      averageRating: number;
      totalReviews: number;
    }>([
      { $match: { ProductID: this.toObjectId(productID) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$Rating" },
          totalReviews: { $sum: 1 },
        },
      },
      { $project: { _id: 0, averageRating: { $round: ["$averageRating", 2] }, totalReviews: 1 } },
    ]);
    return summary ?? { averageRating: 0, totalReviews: 0 };
  }
}

export const reviewRepository = new ReviewRepository();
