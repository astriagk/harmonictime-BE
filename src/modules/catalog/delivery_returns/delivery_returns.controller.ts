import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { deliveryReturnsRepository } from "./delivery_returns.repository";
import { productRepository } from "../product/product.repository";

export const createDeliveryReturn = asyncHandler(
  async (req: Request, res: Response) => {
    const { ProductID, DeliveryInformation, ReturnsPolicy } = req.body;

    const product = await productRepository.findById(ProductID);
    if (!product) throw ApiError.badRequest("Invalid ProductID");

    const result = await deliveryReturnsRepository.insertOne({
      ProductID: new ObjectId(ProductID),
      DeliveryInformation,
      ReturnsPolicy,
      CreatedAt: new Date(),
    });
    sendResponse(
      res,
      HTTP_STATUS.CREATED,
      "Delivery return information created successfully",
      result
    );
  }
);

export const getDeliveryReturnById = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await deliveryReturnsRepository.findById(req.params.deliveryReturnID);
    if (!item) throw ApiError.notFound("Delivery return information not found");
    sendResponse(res, HTTP_STATUS.OK, "", item);
  }
);

export const getAllDeliveryReturnsByProductID = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await deliveryReturnsRepository.findByProductId(req.params.productID);
    sendResponse(
      res,
      HTTP_STATUS.OK,
      "Delivery return information retrieved successfully",
      items
    );
  }
);

export const updateDeliveryReturn = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await deliveryReturnsRepository.updateByProductId(
      req.params.productID,
      req.body
    );
    if (result.matchedCount === 0)
      throw ApiError.notFound("Delivery return information not found");
    sendResponse(res, HTTP_STATUS.OK, "Delivery return information updated successfully");
  }
);

export const deleteDeliveryReturn = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await deliveryReturnsRepository.deleteById(
      req.params.deliveryReturnID
    );
    if (result.deletedCount === 0)
      throw ApiError.notFound("Delivery return information not found");
    sendResponse(res, HTTP_STATUS.OK, "Delivery return information deleted successfully");
  }
);
