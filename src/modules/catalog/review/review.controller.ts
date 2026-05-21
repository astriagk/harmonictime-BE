import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { reviewRepository } from "./review.repository";
import { productRepository } from "../product";

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { ProductID, Rating, Name, Email, Comment } = req.body;

  const product = await productRepository.findById(ProductID);
  if (!product) throw ApiError.notFound("Product not found");

  const doc = {
    _id: new ObjectId(),
    ProductID: new ObjectId(ProductID),
    Rating,
    Name,
    Email,
    Comment,
    CreatedAt: new Date(),
  };
  await reviewRepository.insertOne(doc);
  sendResponse(res, HTTP_STATUS.CREATED, "Review submitted successfully", doc);
});

export const getReviewsByProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productID } = req.params;
  const [reviews, summary] = await Promise.all([
    reviewRepository.findByProduct(productID),
    reviewRepository.getProductSummary(productID),
  ]);
  sendResponse(res, HTTP_STATUS.OK, "", { ...summary, reviews });
});

export const getAllReviews = asyncHandler(async (_req: Request, res: Response) => {
  const items = await reviewRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getReviewById = asyncHandler(async (req: Request, res: Response) => {
  const item = await reviewRepository.findById(req.params.reviewID);
  if (!item) throw ApiError.notFound("Review not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewRepository.deleteById(req.params.reviewID);
  if (result.deletedCount === 0) throw ApiError.notFound("Review not found");
  sendResponse(res, HTTP_STATUS.OK, "Review deleted successfully");
});
