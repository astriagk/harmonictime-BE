import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { watchMarkerRepository } from "./watchMarker.repository";

export const createWatchMarker = asyncHandler(async (req: Request, res: Response) => {
  const { WatchMarkerID, WatchMarkerName } = req.body;

  const existing = await watchMarkerRepository.findByName(WatchMarkerName);
  if (existing)
    throw ApiError.conflict("A watch marker with the same WatchMarkerName already exists");

  const _id =
    WatchMarkerID && ObjectId.isValid(WatchMarkerID) ? new ObjectId(WatchMarkerID) : new ObjectId();
  await watchMarkerRepository.insertOne({ _id, WatchMarkerName });
  sendResponse(res, HTTP_STATUS.CREATED, "Watch marker created successfully", {
    _id,
    WatchMarkerName,
  });
});

export const getAllWatchMarkers = asyncHandler(async (_req: Request, res: Response) => {
  const items = await watchMarkerRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", items);
});

export const getWatchMarkerById = asyncHandler(async (req: Request, res: Response) => {
  const item = await watchMarkerRepository.findById(req.params.watchMarkerID);
  if (!item) throw ApiError.notFound("Watch marker not found");
  sendResponse(res, HTTP_STATUS.OK, "", item);
});

export const updateWatchMarker = asyncHandler(async (req: Request, res: Response) => {
  const { WatchMarkerName } = req.body;
  const duplicate = await watchMarkerRepository.findOne({
    WatchMarkerName,
    _id: { $ne: new ObjectId(req.params.watchMarkerID) },
  } as any);
  if (duplicate)
    throw ApiError.conflict("A watch marker with the same WatchMarkerName already exists");

  const result = await watchMarkerRepository.updateById(req.params.watchMarkerID, {
    WatchMarkerName,
  });
  if (result.matchedCount === 0) throw ApiError.notFound("Watch marker not found");
  sendResponse(res, HTTP_STATUS.OK, "Watch marker updated successfully");
});

export const deleteWatchMarker = asyncHandler(async (req: Request, res: Response) => {
  const result = await watchMarkerRepository.deleteById(req.params.watchMarkerID);
  if (result.deletedCount === 0) throw ApiError.notFound("Watch marker not found");
  sendResponse(res, HTTP_STATUS.OK, "Watch marker deleted successfully");
});
