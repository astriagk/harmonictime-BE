import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { categoryRepository } from "./category.repository";

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { CategoryID, CategoryName } = req.body;

  const existing = await categoryRepository.findByName(CategoryName);
  if (existing)
    throw ApiError.conflict("A category with the same CategoryName already exists");

  const _id =
    CategoryID && ObjectId.isValid(CategoryID) ? new ObjectId(CategoryID) : new ObjectId();
  await categoryRepository.insertOne({ _id, CategoryName });
  sendResponse(res, HTTP_STATUS.CREATED, "Category created successfully", {
    _id,
    CategoryName,
  });
});

export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  const items = await categoryRepository.findAll();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const item = await categoryRepository.findById(req.params.categoryID);
  if (!item) throw ApiError.notFound("Category not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { CategoryName } = req.body;
  const duplicate = await categoryRepository.findOne({
    CategoryName,
    _id: { $ne: new ObjectId(req.params.categoryID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A category with the same CategoryName already exists");

  const result = await categoryRepository.updateById(req.params.categoryID, {
    CategoryName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Category not found");
  sendResponse(res, HTTP_STATUS.OK, "Category updated successfully");
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoryRepository.deleteById(req.params.categoryID);
  if (result.deletedCount === 0) throw ApiError.notFound("Category not found");
  sendResponse(res, HTTP_STATUS.OK, "Category deleted successfully");
});
