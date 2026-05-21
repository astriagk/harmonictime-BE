import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { addressRepository } from "./address.repository";
import { userRepository } from "../user/user.repository";

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const { UserID, AddressLine2, IsDefault, ...rest } = req.body;

  const user = await userRepository.findById(UserID);
  if (!user) throw ApiError.badRequest("Invalid UserID");

  const result = await addressRepository.insertOne({
    UserID: new ObjectId(UserID),
    AddressLine2: AddressLine2 || "",
    IsDefault: IsDefault || false,
    ...rest,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Address created successfully", result);
});

export const getAddressById = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressRepository.findById(req.params.addressID);
  if (!address) throw ApiError.notFound("Address not found");
  sendResponse(res, HTTP_STATUS.OK, "", address);
});

export const getAllAddressesByUserID = asyncHandler(
  async (req: Request, res: Response) => {
    const addresses = await addressRepository.findByUser(req.params.userID);
    sendResponse(res, HTTP_STATUS.OK, "Addresses retrieved successfully", addresses);
  }
);

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const result = await addressRepository.updateById(req.params.addressID, req.body);
  if (result.matchedCount === 0) throw ApiError.notFound("Address not found");
  sendResponse(res, HTTP_STATUS.OK, "Address updated successfully");
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const result = await addressRepository.deleteById(req.params.addressID);
  if (result.deletedCount === 0) throw ApiError.notFound("Address not found");
  sendResponse(res, HTTP_STATUS.OK, "Address deleted successfully");
});
