import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productDetailsRepository } from "./product_details.repository";

const LOOKUP_KEYS = [
  "DialColorID",
  "MovementID",
  "StrapMaterialID",
  "CaseMaterialID",
  "WatchMarkersID",
  "DeliveryOptionID",
] as const;

// Convert valid lookup id strings to ObjectId; "" / invalid → null.
const normaliseLookupIds = (src: Record<string, any>) => {
  const out: Record<string, any> = { ...src };
  for (const key of LOOKUP_KEYS) {
    if (key in out) {
      const v = out[key];
      out[key] = v && ObjectId.isValid(v) ? new ObjectId(v) : null;
    }
  }
  return out;
};

export const createProductDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, ...rest } = req.body;
    const result = await productDetailsRepository.insertOne({
      ProductID: new ObjectId(ProductID),
      ...normaliseLookupIds(rest),
    });
    sendResponse(res, HTTP_STATUS.CREATED, "Product details created successfully", result);
  }
);

export const getProductDetailsByProductID = asyncHandler(
  async (req: Request, res: Response) => {
    const details = await productDetailsRepository.findByProductId(req.params.productID);
    if (!details) throw ApiError.notFound("Product details not found");
    sendResponse(res, HTTP_STATUS.OK, "", details);
  }
);

export const updateProductDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, ...rest } = req.body;
    const result = await productDetailsRepository.updateByProductId(
      req.params.productID,
      normaliseLookupIds(rest)
    );
    if (result.matchedCount === 0) throw ApiError.notFound("Product details not found");
    sendResponse(res, HTTP_STATUS.OK, "Product details updated successfully");
  }
);

export const deleteProductDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productDetailsRepository.deleteByProductId(req.params.productID);
    if (result.deletedCount === 0) throw ApiError.notFound("Product details not found");
    sendResponse(res, HTTP_STATUS.OK, "Product details deleted successfully");
  }
);
