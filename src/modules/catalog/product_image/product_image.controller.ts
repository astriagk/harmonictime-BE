import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productImageRepository } from "./product_image.repository";
import { productRepository } from "../product/product.repository";

export const createProductImage = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, ImageURLs, AltText } = req.body;

    const product = await productRepository.findById(ProductID);
    if (!product) throw ApiError.badRequest("Invalid ProductID");

    const productObjectId = new ObjectId(ProductID);
    const docs = (ImageURLs as { url: string; key?: string }[]).map(
      (img, index) => ({
        ProductID: productObjectId,
        ImageURL: img.url,
        key: img.key,
        IsPrimary: index === 0,
        AltText: AltText || "",
      })
    );
    await productImageRepository.insertMany(docs);
    sendResponse(res, HTTP_STATUS.CREATED, "Product images created successfully");
  }
);

export const getProductImageById = asyncHandler(
  async (req: Request, res: Response) => {
    const image = await productImageRepository.findById(req.params.imageID);
    if (!image) throw ApiError.notFound("Product image not found");
    sendResponse(res, HTTP_STATUS.OK, "", image);
  }
);

export const getAllProductImagesByProductID = asyncHandler(
  async (req: Request, res: Response) => {
    const images = await productImageRepository.findByProductId(req.params.productID);
    sendResponse(res, HTTP_STATUS.OK, "Product images retrieved successfully", images);
  }
);

export const updateProductImage = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productImageRepository.updateById(req.params.imageID, req.body);
    if (result.matchedCount === 0) throw ApiError.notFound("Product image not found");
    sendResponse(res, HTTP_STATUS.OK, "Product image updated successfully");
  }
);

export const deleteProductImage = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productImageRepository.deleteById(req.params.imageID);
    if (result.deletedCount === 0) throw ApiError.notFound("Product image not found");
    sendResponse(res, HTTP_STATUS.OK, "Product image deleted successfully");
  }
);
