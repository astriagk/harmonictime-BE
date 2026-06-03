import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { deliveryOptionRepository } from "./deliveryOption.repository";

export const createDeliveryOption = asyncHandler(async (req: Request, res: Response) => {
  const { DeliveryOptionID, DeliveryOptionName } = req.body;

  const existing = await deliveryOptionRepository.findByName(DeliveryOptionName);
  if (existing)
    throw ApiError.conflict("A delivery option with the same DeliveryOptionName already exists");

  const _id =
    DeliveryOptionID && ObjectId.isValid(DeliveryOptionID) ? new ObjectId(DeliveryOptionID) : new ObjectId();
  await deliveryOptionRepository.insertOne({ _id, DeliveryOptionName });
  sendResponse(res, HTTP_STATUS.CREATED, "Delivery option created successfully", {
    _id,
    DeliveryOptionName,
  });
});

export const getAllDeliveryOptions = asyncHandler(async (_req: Request, res: Response) => {
  const items = await deliveryOptionRepository.findAll();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getDeliveryOptionById = asyncHandler(async (req: Request, res: Response) => {
  const item = await deliveryOptionRepository.findById(req.params.deliveryOptionID);
  if (!item) throw ApiError.notFound("Delivery option not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateDeliveryOption = asyncHandler(async (req: Request, res: Response) => {
  const { DeliveryOptionName } = req.body;
  const duplicate = await deliveryOptionRepository.findOne({
    DeliveryOptionName,
    _id: { $ne: new ObjectId(req.params.deliveryOptionID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A delivery option with the same DeliveryOptionName already exists");

  const result = await deliveryOptionRepository.updateById(req.params.deliveryOptionID, {
    DeliveryOptionName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Delivery option not found");
  sendResponse(res, HTTP_STATUS.OK, "Delivery option updated successfully");
});

export const deleteDeliveryOption = asyncHandler(async (req: Request, res: Response) => {
  const result = await deliveryOptionRepository.deleteById(req.params.deliveryOptionID);
  if (result.deletedCount === 0) throw ApiError.notFound("Delivery option not found");
  sendResponse(res, HTTP_STATUS.OK, "Delivery option deleted successfully");
});
