import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { brandRepository } from "./brand.repository";

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const { BrandName } = req.body;
  const existing = await brandRepository.findByName(BrandName);
  if (existing)
    throw ApiError.conflict("A brand with the same BrandName already exists");

  const _id = new ObjectId();
  await brandRepository.insertOne({ _id, BrandName });
  sendResponse(res, HTTP_STATUS.CREATED, "Brand created successfully", {
    _id,
    BrandName,
  });
});

export const createMultipleBrands = asyncHandler(
  async (req: Request, res: Response) => {
    const { watchBrands } = req.body;
    const names = watchBrands.map((b: { BrandName: string }) => b.BrandName);
    const existing = await brandRepository.findByNames(names);
    if (existing.length > 0) {
      const existingNames = existing.map((b) => b.BrandName);
      throw ApiError.conflict(`Some brands already exist: ${existingNames.join(", ")}`);
    }
    const result = await brandRepository.insertMany(watchBrands);
    sendResponse(res, HTTP_STATUS.CREATED, "Brands inserted successfully", result);
  }
);

export const getAllBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await brandRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", brands);
});

export const getBrandById = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandRepository.findById(req.params.brandID);
  if (!brand) throw ApiError.notFound("Brand not found");
  sendResponse(res, HTTP_STATUS.OK, "", brand);
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const { BrandName } = req.body;
  const duplicate = await brandRepository.findOne({
    BrandName,
    _id: { $ne: new ObjectId(req.params.brandID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A brand with the same BrandName already exists");

  const result = await brandRepository.updateById(req.params.brandID, { BrandName });
  if (result.matchedCount === 0) throw ApiError.notFound("Brand not found");
  sendResponse(res, HTTP_STATUS.OK, "Brand updated successfully");
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  const result = await brandRepository.deleteById(req.params.brandID);
  if (result.deletedCount === 0) throw ApiError.notFound("Brand not found");
  sendResponse(res, HTTP_STATUS.OK, "Brand deleted successfully");
});
