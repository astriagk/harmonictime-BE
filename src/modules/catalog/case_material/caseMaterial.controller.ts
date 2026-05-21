import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { caseMaterialRepository } from "./caseMaterial.repository";

export const createCaseMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { CaseMaterialID, CaseMaterialName } = req.body;

  const existing = await caseMaterialRepository.findByName(CaseMaterialName);
  if (existing)
    throw ApiError.conflict("A case material with the same CaseMaterialName already exists");

  const _id =
    CaseMaterialID && ObjectId.isValid(CaseMaterialID) ? new ObjectId(CaseMaterialID) : new ObjectId();
  await caseMaterialRepository.insertOne({ _id, CaseMaterialName });
  sendResponse(res, HTTP_STATUS.CREATED, "Case material created successfully", {
    _id,
    CaseMaterialName,
  });
});

export const getAllCaseMaterials = asyncHandler(async (_req: Request, res: Response) => {
  const items = await caseMaterialRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getCaseMaterialById = asyncHandler(async (req: Request, res: Response) => {
  const item = await caseMaterialRepository.findById(req.params.caseMaterialID);
  if (!item) throw ApiError.notFound("Case material not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateCaseMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { CaseMaterialName } = req.body;
  const duplicate = await caseMaterialRepository.findOne({
    CaseMaterialName,
    _id: { $ne: new ObjectId(req.params.caseMaterialID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A case material with the same CaseMaterialName already exists");

  const result = await caseMaterialRepository.updateById(req.params.caseMaterialID, {
    CaseMaterialName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Case material not found");
  sendResponse(res, HTTP_STATUS.OK, "Case material updated successfully");
});

export const deleteCaseMaterial = asyncHandler(async (req: Request, res: Response) => {
  const result = await caseMaterialRepository.deleteById(req.params.caseMaterialID);
  if (result.deletedCount === 0) throw ApiError.notFound("Case material not found");
  sendResponse(res, HTTP_STATUS.OK, "Case material deleted successfully");
});
