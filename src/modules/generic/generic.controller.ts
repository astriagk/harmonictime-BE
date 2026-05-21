import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { getDB } from "../../shared/config/database";

// Dev/seed helper: bulk-insert arbitrary documents into a named collection.
export const createCollectionItems = asyncHandler(
  async (req: Request, res: Response) => {
    const { collectionName, items } = req.body;

    if (!collectionName || typeof collectionName !== "string")
      throw ApiError.badRequest("Invalid collection name");
    if (!Array.isArray(items) || items.length === 0)
      throw ApiError.badRequest("Items must be a non-empty array");

    const itemsWithIds = items.map((item) => ({ ...item, _id: new ObjectId() }));
    const result = await getDB().collection(collectionName).insertMany(itemsWithIds);
    sendResponse(res, HTTP_STATUS.CREATED, "Items inserted successfully", result);
  }
);
