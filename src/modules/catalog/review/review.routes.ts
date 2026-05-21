import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createReview,
  getReviewsByProduct,
  getAllReviews,
  getReviewById,
  deleteReview,
} from "./review.controller";
import { createReviewSchema } from "./review.validation";

const router: Router = Router();

router.post("/", validate(createReviewSchema), createReview);
router.get("/", getAllReviews);
router.get("/product/:productID", getReviewsByProduct);
router.get("/:reviewID", getReviewById);
router.delete("/:reviewID", deleteReview);

export default router;
