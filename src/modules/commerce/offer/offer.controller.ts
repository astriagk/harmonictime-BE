import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { offerRepository } from "./offer.repository";

export const createOffer = asyncHandler(async (req: Request, res: Response) => {
  const { OfferName, Description, DiscountPercentage, StartDate, EndDate, IsActive } =
    req.body;

  const existing = await offerRepository.findByName(OfferName);
  if (existing) throw ApiError.conflict("OfferName must be unique");

  const _id = new ObjectId();
  await offerRepository.insertOne({
    _id,
    OfferName,
    Description: Description || "",
    DiscountPercentage,
    StartDate: new Date(StartDate),
    EndDate: new Date(EndDate),
    IsActive: IsActive !== undefined ? IsActive : true,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Offer created successfully", { _id });
});

export const getOfferById = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerRepository.findById(req.params.offerID);
  if (!offer) throw ApiError.notFound("Offer not found");
  sendResponse(res, HTTP_STATUS.OK, "", offer);
});

export const getAllActiveOffers = asyncHandler(
  async (_req: Request, res: Response) => {
    const offers = await offerRepository.findActive();
    sendResponse(res, HTTP_STATUS.OK, "Active offers retrieved successfully", offers);
  }
);

export const getAllOffers = asyncHandler(
  async (_req: Request, res: Response) => {
    const offers = await offerRepository.findAll();
    sendResponse(res, HTTP_STATUS.OK, "Offers retrieved successfully", offers);
  }
);

// Dedicated enable/disable toggle, clearer in intent than the generic update.
export const setOfferStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { IsActive } = req.body;
    const result = await offerRepository.setActive(req.params.offerID, IsActive);
    if (result.matchedCount === 0) throw ApiError.notFound("Offer not found");
    sendResponse(
      res,
      HTTP_STATUS.OK,
      `Offer ${IsActive ? "enabled" : "disabled"} successfully`
    );
  }
);

export const updateOffer = asyncHandler(async (req: Request, res: Response) => {
  const result = await offerRepository.updateById(req.params.offerID, req.body);
  if (result.matchedCount === 0) throw ApiError.notFound("Offer not found");
  sendResponse(res, HTTP_STATUS.OK, "Offer updated successfully");
});

export const deleteOffer = asyncHandler(async (req: Request, res: Response) => {
  const result = await offerRepository.deleteById(req.params.offerID);
  if (result.deletedCount === 0) throw ApiError.notFound("Offer not found");
  sendResponse(res, HTTP_STATUS.OK, "Offer deleted successfully");
});
