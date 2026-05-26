import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createUserReview,
  getReviewsByUser,
  getAllUserReviews,
  getUserReviewById,
  deleteUserReview,
} from "./user-review.controller";
import { createUserReviewSchema } from "./user-review.validation";

const router: Router = Router();

router.post("/", validate(createUserReviewSchema), createUserReview);
router.get("/", getAllUserReviews);
router.get("/user/:userID", getReviewsByUser);
router.get("/:reviewID", getUserReviewById);
router.delete("/:reviewID", deleteUserReview);

export default router;
