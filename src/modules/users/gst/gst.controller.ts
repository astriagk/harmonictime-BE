import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { gstRepository } from "./gst.repository";

const sellerObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

export const createGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);

    const existing = await gstRepository.findBySeller(userId);
    if (existing) throw ApiError.conflict("GST details already exist. Use PUT to update.");

    const duplicate = await gstRepository.findByGSTIN(req.body.GSTIN.toUpperCase());
    if (duplicate) throw ApiError.conflict("This GSTIN is already registered with another account.");

    const result = await gstRepository.insertOne({
      UserID: userId,
      GSTIN: req.body.GSTIN.toUpperCase(),
      LegalBusinessName: req.body.LegalBusinessName,
      TradeName: req.body.TradeName,
      BusinessType: req.body.BusinessType,
      RegisteredAddress: req.body.RegisteredAddress,
      State: req.body.State,
      PinCode: req.body.PinCode,
      IsVerified: false,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    });

    sendResponse(res, HTTP_STATUS.CREATED, "GST details saved successfully", result);
  }
);

export const getGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const gst = await gstRepository.findBySeller(userId);
    if (!gst) throw ApiError.notFound("GST details not found");
    sendResponse(res, HTTP_STATUS.OK, "GST details retrieved successfully", gst);
  }
);

export const updateGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const gst = await gstRepository.findById(id);
    if (!gst || gst.UserID.toString() !== userId.toString())
      throw ApiError.notFound("GST details not found");

    if (req.body.GSTIN) {
      const upper = req.body.GSTIN.toUpperCase();
      const duplicate = await gstRepository.findByGSTIN(upper);
      if (duplicate && duplicate._id!.toString() !== id)
        throw ApiError.conflict("This GSTIN is already registered with another account.");
      req.body.GSTIN = upper;
    }

    await gstRepository.updateById(new ObjectId(id), {
      ...req.body,
      IsVerified: false,
      UpdatedAt: new Date(),
    });

    sendResponse(res, HTTP_STATUS.OK, "GST details updated successfully");
  }
);

export const deleteGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const gst = await gstRepository.findById(id);
    if (!gst || gst.UserID.toString() !== userId.toString())
      throw ApiError.notFound("GST details not found");

    await gstRepository.deleteById(new ObjectId(id));
    sendResponse(res, HTTP_STATUS.OK, "GST details deleted successfully");
  }
);

// Admin: list all GST records
export const adminListGSTDetails = asyncHandler(
  async (_req: Request, res: Response) => {
    const records = await gstRepository.find({});
    sendResponse(res, HTTP_STATUS.OK, "GST records retrieved successfully", records);
  }
);

// Admin: mark GST as verified
export const adminVerifyGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const gst = await gstRepository.findById(id);
    if (!gst) throw ApiError.notFound("GST details not found");

    await gstRepository.updateById(new ObjectId(id), {
      IsVerified: true,
      UpdatedAt: new Date(),
    });

    sendResponse(res, HTTP_STATUS.OK, "GST details verified successfully");
  }
);
