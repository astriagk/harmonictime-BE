import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { userReviewRepository } from "./user-review.repository";
import { productRepository } from "../../catalog/product";

export const createUserReview = asyncHandler(async (req: Request, res: Response) => {
  const { ProductID, Rating, Subject, Name, Email, Comment } = req.body;

  const product = await productRepository.findById(ProductID);
  if (!product) throw ApiError.notFound("Product not found");

  const doc = {
    _id: new ObjectId(),
    UserID: product.UserID,
    ProductID: new ObjectId(ProductID),
    Rating,
    Subject,
    Name: Name || undefined,
    Email,
    Comment,
    CreatedAt: new Date(),
  };
  await userReviewRepository.insertOne(doc);
  sendResponse(res, HTTP_STATUS.CREATED, "Review submitted successfully", doc);
});

export const getReviewsByUser = asyncHandler(async (req: Request, res: Response) => {
  const { userID } = req.params;
  const [reviews, summary] = await Promise.all([
    userReviewRepository.findByUser(userID),
    userReviewRepository.getUserSummary(userID),
  ]);
  sendResponse(res, HTTP_STATUS.OK, "", { ...summary, reviews });
});

export const getAllUserReviews = asyncHandler(async (_req: Request, res: Response) => {
  const items = await userReviewRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getUserReviewById = asyncHandler(async (req: Request, res: Response) => {
  const item = await userReviewRepository.findById(req.params.reviewID);
  if (!item) throw ApiError.notFound("Review not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const deleteUserReview = asyncHandler(async (req: Request, res: Response) => {
  const result = await userReviewRepository.deleteById(req.params.reviewID);
  if (result.deletedCount === 0) throw ApiError.notFound("Review not found");
  sendResponse(res, HTTP_STATUS.OK, "Review deleted successfully");
});
