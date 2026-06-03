import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { recipientRepository } from "./recipient.repository";

export const createRecipient = asyncHandler(async (req: Request, res: Response) => {
  const { RecipientID, RecipientName } = req.body;

  const existing = await recipientRepository.findByName(RecipientName);
  if (existing)
    throw ApiError.conflict("A recipient with the same RecipientName already exists");

  const _id =
    RecipientID && ObjectId.isValid(RecipientID) ? new ObjectId(RecipientID) : new ObjectId();
  await recipientRepository.insertOne({ _id, RecipientName });
  sendResponse(res, HTTP_STATUS.CREATED, "Recipient created successfully", {
    _id,
    RecipientName,
  });
});

export const getAllRecipients = asyncHandler(async (_req: Request, res: Response) => {
  const items = await recipientRepository.findAll();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getRecipientById = asyncHandler(async (req: Request, res: Response) => {
  const item = await recipientRepository.findById(req.params.recipientID);
  if (!item) throw ApiError.notFound("Recipient not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateRecipient = asyncHandler(async (req: Request, res: Response) => {
  const { RecipientName } = req.body;
  const duplicate = await recipientRepository.findOne({
    RecipientName,
    _id: { $ne: new ObjectId(req.params.recipientID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A recipient with the same RecipientName already exists");

  const result = await recipientRepository.updateById(req.params.recipientID, {
    RecipientName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Recipient not found");
  sendResponse(res, HTTP_STATUS.OK, "Recipient updated successfully");
});

export const deleteRecipient = asyncHandler(async (req: Request, res: Response) => {
  const result = await recipientRepository.deleteById(req.params.recipientID);
  if (result.deletedCount === 0) throw ApiError.notFound("Recipient not found");
  sendResponse(res, HTTP_STATUS.OK, "Recipient deleted successfully");
});
