import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { dialColorRepository } from "./dialColor.repository";

export const createDialColor = asyncHandler(async (req: Request, res: Response) => {
  const { DialColorID, DialColorName } = req.body;

  const existing = await dialColorRepository.findByName(DialColorName);
  if (existing)
    throw ApiError.conflict("A dial color with the same DialColorName already exists");

  const _id =
    DialColorID && ObjectId.isValid(DialColorID) ? new ObjectId(DialColorID) : new ObjectId();
  await dialColorRepository.insertOne({ _id, DialColorName });
  sendResponse(res, HTTP_STATUS.CREATED, "Dial color created successfully", {
    _id,
    DialColorName,
  });
});

export const getAllDialColors = asyncHandler(async (_req: Request, res: Response) => {
  const items = await dialColorRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getDialColorById = asyncHandler(async (req: Request, res: Response) => {
  const item = await dialColorRepository.findById(req.params.dialColorID);
  if (!item) throw ApiError.notFound("Dial color not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateDialColor = asyncHandler(async (req: Request, res: Response) => {
  const { DialColorName } = req.body;
  const duplicate = await dialColorRepository.findOne({
    DialColorName,
    _id: { $ne: new ObjectId(req.params.dialColorID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A dial color with the same DialColorName already exists");

  const result = await dialColorRepository.updateById(req.params.dialColorID, {
    DialColorName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Dial color not found");
  sendResponse(res, HTTP_STATUS.OK, "Dial color updated successfully");
});

export const deleteDialColor = asyncHandler(async (req: Request, res: Response) => {
  const result = await dialColorRepository.deleteById(req.params.dialColorID);
  if (result.deletedCount === 0) throw ApiError.notFound("Dial color not found");
  sendResponse(res, HTTP_STATUS.OK, "Dial color deleted successfully");
});
