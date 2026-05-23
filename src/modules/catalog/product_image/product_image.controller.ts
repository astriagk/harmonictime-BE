import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productImageRepository } from "./product_image.repository";
import { productRepository } from "../product/product.repository";
import { deleteFile } from "../../../shared/services/file-storage.service";

export const createProductImage = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, ImageURLs, AltText } = req.body;

    const product = await productRepository.findById(ProductID);
    if (!product) throw ApiError.badRequest("Invalid ProductID");

    const productObjectId = new ObjectId(ProductID);
    const images = ImageURLs as {
      url: string;
      key?: string;
      IsPrimary?: boolean;
    }[];

    // Use the primary flag from the payload; if the frontend doesn't mark any
    // image as primary, fall back to making the first image primary.
    const hasExplicitPrimary = images.some((img) => img.IsPrimary);
    const docs = images.map((img, index) => ({
      ProductID: productObjectId,
      ImageURL: img.url,
      key: img.key,
      IsPrimary: hasExplicitPrimary ? !!img.IsPrimary : index === 0,
      AltText: AltText || "",
    }));
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
    const image = await productImageRepository.findById(req.params.imageID);
    if (!image) throw ApiError.notFound("Product image not found");

    // Remove the underlying S3 object first; deleteFile is idempotent and
    // error-safe, so a missing object won't block the DB cleanup.
    await deleteFile(image.key || image.ImageURL);

    await productImageRepository.deleteById(req.params.imageID);
    sendResponse(res, HTTP_STATUS.OK, "Product image deleted successfully");
  }
);
