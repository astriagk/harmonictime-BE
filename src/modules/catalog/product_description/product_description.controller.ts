import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productDescriptionRepository } from "./product_description.repository";
import { productRepository } from "../product/product.repository";

export const createProductDescription = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, Title, Content, AdditionalDetails } = req.body;

    const product = await productRepository.findById(ProductID);
    if (!product) throw ApiError.badRequest("Invalid ProductID");

    const result = await productDescriptionRepository.insertOne({
      ProductID: new ObjectId(ProductID),
      Title,
      Content,
      AdditionalDetails,
      CreatedAt: new Date(),
    });
    sendResponse(
      res,
      HTTP_STATUS.CREATED,
      "Product description created successfully",
      result
    );
  }
);

export const getAllProductDescriptions = asyncHandler(
  async (_req: Request, res: Response) => {
    const items = await productDescriptionRepository.find();
    sendResponse(res, HTTP_STATUS.OK, "Product descriptions retrieved successfully", items);
  }
);

export const getProductDescriptionByProductID = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await productDescriptionRepository.findByProductId(
      req.params.productID
    );
    if (!item) throw ApiError.notFound("Product description not found");
    sendResponse(res, HTTP_STATUS.OK, "", item);
  }
);

export const updateProductDescription = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productDescriptionRepository.updateByProductId(
      req.params.productID,
      req.body
    );
    if (result.matchedCount === 0)
      throw ApiError.notFound("Product description not found");
    sendResponse(res, HTTP_STATUS.OK, "Product description updated successfully");
  }
);

export const deleteProductDescription = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productDescriptionRepository.deleteByProductId(
      req.params.productID
    );
    if (result.deletedCount === 0)
      throw ApiError.notFound("Product description not found");
    sendResponse(res, HTTP_STATUS.OK, "Product description deleted successfully");
  }
);
