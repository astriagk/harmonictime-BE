import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { UserReview } from "./user-review.types";

class UserReviewRepository extends BaseRepository<UserReview> {
  constructor() {
    super(COLLECTIONS.USER_REVIEWS);
  }

  findByUser(userID: string | ObjectId) {
    return this.find({ UserID: this.toObjectId(userID) });
  }

  async getUserSummary(userID: string | ObjectId) {
    const [summary] = await this.aggregate<{
      averageRating: number;
      totalReviews: number;
    }>([
      { $match: { UserID: this.toObjectId(userID) } },
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

export const userReviewRepository = new UserReviewRepository();
