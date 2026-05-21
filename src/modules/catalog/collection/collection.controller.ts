import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { collectionRepository } from "./collection.repository";
import { brandRepository } from "../brand/brand.repository";

export const createCollection = asyncHandler(
  async (req: Request, res: Response) => {
    const { CollectionID, BrandID, CollectionName } = req.body;

    const brand = await brandRepository.findById(BrandID);
    if (!brand) throw ApiError.badRequest("Invalid BrandID");

    const existing = await collectionRepository.findByName(CollectionName);
    if (existing)
      throw ApiError.conflict("A collection with the same CollectionName already exists");

    const _id =
      CollectionID && ObjectId.isValid(CollectionID)
        ? new ObjectId(CollectionID)
        : new ObjectId();

    await collectionRepository.insertOne({
      _id,
      BrandID: new ObjectId(BrandID),
      CollectionName,
    });
    sendResponse(res, HTTP_STATUS.CREATED, "Collection created successfully", {
      _id,
    });
  }
);

export const getAllCollections = asyncHandler(
  async (req: Request, res: Response) => {
    const { BrandID } = req.query;
    const filter = BrandID
      ? { BrandID: new ObjectId(BrandID as string) }
      : {};
    const collections = await collectionRepository.list(filter);
    sendResponse(res, HTTP_STATUS.OK, "", collections);
  }
);

export const getCollectionById = asyncHandler(
  async (req: Request, res: Response) => {
    const collection = await collectionRepository.findById(req.params.collectionID);
    if (!collection) throw ApiError.notFound("Collection not found");
    sendResponse(res, HTTP_STATUS.OK, "", collection);
  }
);

export const updateCollection = asyncHandler(
  async (req: Request, res: Response) => {
    const { CollectionName, BrandID } = req.body;

    if (BrandID) {
      const brand = await brandRepository.findById(BrandID);
      if (!brand) throw ApiError.badRequest("Invalid BrandID");
    }

    if (CollectionName) {
      const duplicate = await collectionRepository.findOne({
        CollectionName,
        _id: { $ne: new ObjectId(req.params.collectionID) },
      } as any);
      if (duplicate)
        throw ApiError.conflict("A collection with the same CollectionName already exists");
    }

    const update: any = {};
    if (CollectionName) update.CollectionName = CollectionName;
    if (BrandID) update.BrandID = new ObjectId(BrandID);

    const result = await collectionRepository.updateById(
      req.params.collectionID,
      update
    );
    if (result.matchedCount === 0) throw ApiError.notFound("Collection not found");
    sendResponse(res, HTTP_STATUS.OK, "Collection updated successfully");
  }
);

export const deleteCollection = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await collectionRepository.deleteById(req.params.collectionID);
    if (result.deletedCount === 0) throw ApiError.notFound("Collection not found");
    sendResponse(res, HTTP_STATUS.OK, "Collection deleted successfully");
  }
);
