import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { recentlyViewedRepository } from "./recently_viewed.repository";
import { userRepository } from "../../users/user/user.repository";
import { productRepository } from "../../catalog/product/product.repository";

export const addRecentlyViewedProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { UserID, ProductID, ViewedAt } = req.body;
    const userObjectId = new ObjectId(UserID);
    const productObjectId = new ObjectId(ProductID);

    if (!(await userRepository.findById(userObjectId)))
      throw ApiError.badRequest("Invalid UserID");
    if (!(await productRepository.findById(productObjectId)))
      throw ApiError.badRequest("Invalid ProductID");

    const result = await recentlyViewedRepository.insertOne({
      UserID: userObjectId,
      ProductID: productObjectId,
      ViewedAt: ViewedAt ? new Date(ViewedAt) : new Date(),
    });
    sendResponse(res, HTTP_STATUS.CREATED, "Recently viewed product added successfully", result);
  }
);

export const getRecentlyViewedProductsByUserID = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await recentlyViewedRepository.findByUserSorted(req.params.userID);
    sendResponse(res, HTTP_STATUS.OK, "Recently viewed products retrieved successfully", items);
  }
);

export const deleteRecentlyViewedProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await recentlyViewedRepository.deleteById(req.params.viewID);
    if (result.deletedCount === 0)
      throw ApiError.notFound("Recently viewed product not found");
    sendResponse(res, HTTP_STATUS.OK, "Recently viewed product deleted successfully");
  }
);
