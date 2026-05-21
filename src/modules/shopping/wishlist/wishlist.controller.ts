import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { wishlistRepository } from "./wishlist.repository";
import { userRepository } from "../../users/user/user.repository";
import { productRepository } from "../../catalog/product/product.repository";

export const addProductToWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const { UserID, ProductID } = req.body;
    const userObjectId = new ObjectId(UserID);
    const productObjectId = new ObjectId(ProductID);

    if (!(await userRepository.findById(userObjectId)))
      throw ApiError.badRequest("Invalid UserID");
    if (!(await productRepository.findById(productObjectId)))
      throw ApiError.badRequest("Invalid ProductID");

    const existing = await wishlistRepository.findByUserAndProduct(
      userObjectId,
      productObjectId
    );
    if (existing) throw ApiError.conflict("Product already in wishlist");

    const result = await wishlistRepository.insertOne({
      UserID: userObjectId,
      ProductID: productObjectId,
    });
    sendResponse(res, HTTP_STATUS.CREATED, "Product added to wishlist successfully", result);
  }
);

export const getWishlistByUserID = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await wishlistRepository.findByUser(req.params.userID);
    sendResponse(res, HTTP_STATUS.OK, "Wishlist retrieved successfully", items);
  }
);

export const removeProductFromWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await wishlistRepository.deleteById(req.params.wishlistID);
    if (result.deletedCount === 0) throw ApiError.notFound("Wishlist item not found");
    sendResponse(res, HTTP_STATUS.OK, "Product removed from wishlist successfully");
  }
);
