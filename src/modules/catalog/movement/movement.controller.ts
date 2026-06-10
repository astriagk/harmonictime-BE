import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { movementRepository } from "./movement.repository";

export const createMovement = asyncHandler(async (req: Request, res: Response) => {
  const { MovementID, MovementName } = req.body;

  const existing = await movementRepository.findByName(MovementName);
  if (existing)
    throw ApiError.conflict("A movement with the same MovementName already exists");

  const _id =
    MovementID && ObjectId.isValid(MovementID) ? new ObjectId(MovementID) : new ObjectId();
  await movementRepository.insertOne({ _id, MovementName });
  sendResponse(res, HTTP_STATUS.CREATED, "Movement created successfully", {
    _id,
    MovementName,
  });
});

export const getAllMovements = asyncHandler(async (_req: Request, res: Response) => {
  const items = await movementRepository.findAll();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getMovementById = asyncHandler(async (req: Request, res: Response) => {
  const item = await movementRepository.findById(req.params.movementID);
  if (!item) throw ApiError.notFound("Movement not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateMovement = asyncHandler(async (req: Request, res: Response) => {
  const { MovementName } = req.body;
  const duplicate = await movementRepository.findOne({
    MovementName,
    _id: { $ne: new ObjectId(req.params.movementID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A movement with the same MovementName already exists");

  const result = await movementRepository.updateById(req.params.movementID, {
    MovementName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Movement not found");
  sendResponse(res, HTTP_STATUS.OK, "Movement updated successfully");
});

export const deleteMovement = asyncHandler(async (req: Request, res: Response) => {
  const result = await movementRepository.deleteById(req.params.movementID);
  if (result.deletedCount === 0) throw ApiError.notFound("Movement not found");
  sendResponse(res, HTTP_STATUS.OK, "Movement deleted successfully");
});
