import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { strapMaterialRepository } from "./strapMaterial.repository";

export const createStrapMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { StrapMaterialID, StrapMaterialName } = req.body;

  const existing = await strapMaterialRepository.findByName(StrapMaterialName);
  if (existing)
    throw ApiError.conflict("A strap material with the same StrapMaterialName already exists");

  const _id =
    StrapMaterialID && ObjectId.isValid(StrapMaterialID) ? new ObjectId(StrapMaterialID) : new ObjectId();
  await strapMaterialRepository.insertOne({ _id, StrapMaterialName });
  sendResponse(res, HTTP_STATUS.CREATED, "Strap material created successfully", {
    _id,
    StrapMaterialName,
  });
});

export const getAllStrapMaterials = asyncHandler(async (_req: Request, res: Response) => {
  const items = await strapMaterialRepository.findAll();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getStrapMaterialById = asyncHandler(async (req: Request, res: Response) => {
  const item = await strapMaterialRepository.findById(req.params.strapMaterialID);
  if (!item) throw ApiError.notFound("Strap material not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateStrapMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { StrapMaterialName } = req.body;
  const duplicate = await strapMaterialRepository.findOne({
    StrapMaterialName,
    _id: { $ne: new ObjectId(req.params.strapMaterialID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A strap material with the same StrapMaterialName already exists");

  const result = await strapMaterialRepository.updateById(req.params.strapMaterialID, {
    StrapMaterialName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Strap material not found");
  sendResponse(res, HTTP_STATUS.OK, "Strap material updated successfully");
});

export const deleteStrapMaterial = asyncHandler(async (req: Request, res: Response) => {
  const result = await strapMaterialRepository.deleteById(req.params.strapMaterialID);
  if (result.deletedCount === 0) throw ApiError.notFound("Strap material not found");
  sendResponse(res, HTTP_STATUS.OK, "Strap material deleted successfully");
});
