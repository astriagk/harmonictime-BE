import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { checkoutRepository } from "./checkout.repository";
import { userRepository } from "../../users/user/user.repository";
import { addressRepository } from "../../users/address/address.repository";

export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  const { UserID, AddressID, TotalAmount, PaymentStatus, DeliveryStatus, CheckoutDate, ProductIDs } =
    req.body;

  if (!(await userRepository.findById(UserID)))
    throw ApiError.badRequest("Invalid UserID");
  if (!(await addressRepository.findById(AddressID)))
    throw ApiError.badRequest("Invalid AddressID");

  const result = await checkoutRepository.insertOne({
    UserID: new ObjectId(UserID),
    AddressID: new ObjectId(AddressID),
    TotalAmount,
    PaymentStatus,
    DeliveryStatus,
    CheckoutDate: new Date(CheckoutDate),
    ProductIDs: (ProductIDs as string[]).map((id) => new ObjectId(id)),
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Checkout created successfully", result);
});

export const getCheckoutById = asyncHandler(async (req: Request, res: Response) => {
  const checkout = await checkoutRepository.findById(req.params.checkoutID);
  if (!checkout) throw ApiError.notFound("Checkout not found");
  sendResponse(res, HTTP_STATUS.OK, "", checkout);
});

export const getAllCheckoutsByUserID = asyncHandler(
  async (req: Request, res: Response) => {
    const checkouts = await checkoutRepository.getEnrichedByUser(
      new ObjectId(req.params.userID)
    );
    sendResponse(res, HTTP_STATUS.OK, "Checkouts retrieved successfully", checkouts);
  }
);

// Orders containing this seller's products (only their line items per order).
export const getOrdersBySeller = asyncHandler(
  async (req: Request, res: Response) => {
    const { sellerID } = req.params;
    if (!ObjectId.isValid(sellerID))
      throw ApiError.badRequest("Invalid sellerID");

    const orders = await checkoutRepository.getOrdersBySeller(
      new ObjectId(sellerID)
    );
    sendResponse(res, HTTP_STATUS.OK, "Seller orders retrieved successfully", orders);
  }
);

export const updateCheckoutStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { PaymentStatus, DeliveryStatus } = req.body;
    const update: any = {};
    if (PaymentStatus) update.PaymentStatus = PaymentStatus;
    if (DeliveryStatus) update.DeliveryStatus = DeliveryStatus;

    const result = await checkoutRepository.updateById(req.params.checkoutID, update);
    if (result.matchedCount === 0) throw ApiError.notFound("Checkout not found");
    sendResponse(res, HTTP_STATUS.OK, "Checkout status updated successfully");
  }
);

export const deleteCheckout = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkoutRepository.deleteById(req.params.checkoutID);
  if (result.deletedCount === 0) throw ApiError.notFound("Checkout not found");
  sendResponse(res, HTTP_STATUS.OK, "Checkout deleted successfully");
});
