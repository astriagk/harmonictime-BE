import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { checkoutItemRepository } from "./checkout_item.repository";
import { checkoutRepository } from "../checkout/checkout.repository";
import { productRepository } from "../../catalog/product/product.repository";

export const addItemToCheckout = asyncHandler(async (req: Request, res: Response) => {
  const { CheckoutID, ProductIDs, Price, Quantity } = req.body;

  if (!(await checkoutRepository.findById(CheckoutID)))
    throw ApiError.badRequest("Invalid CheckoutID");

  const uniqueProductIDs = [...new Set(ProductIDs as string[])];
  const productObjectIds = uniqueProductIDs.map((id) => new ObjectId(id));
  const found = await productRepository.find({ _id: { $in: productObjectIds } } as any);
  if (found.length !== uniqueProductIDs.length) {
    const foundIds = found.map((p) => p._id!.toString());
    const missing = uniqueProductIDs.filter((id) => !foundIds.includes(id));
    throw ApiError.badRequest(`Invalid ProductIDs: ${missing.join(", ")}`);
  }

  const result = await checkoutItemRepository.insertOne({
    CheckoutID: new ObjectId(CheckoutID),
    ProductIDs: productObjectIds,
    Price,
    Quantity,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Item added to checkout successfully", result);
});

export const getCheckoutItemsByCheckoutID = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await checkoutItemRepository.findByCheckout(req.params.checkoutID);
    sendResponse(res, HTTP_STATUS.OK, "Checkout items retrieved successfully", items);
  }
);

export const getAllCheckoutItems = asyncHandler(
  async (_req: Request, res: Response) => {
    const items = await checkoutItemRepository.find();
    sendResponse(res, HTTP_STATUS.OK, "Checkout items retrieved successfully", items);
  }
);

export const updateCheckoutItemQuantity = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await checkoutItemRepository.updateById(req.params.checkoutItemID, {
      Quantity: req.body.Quantity,
    });
    if (result.matchedCount === 0) throw ApiError.notFound("Checkout item not found");
    sendResponse(res, HTTP_STATUS.OK, "Checkout item quantity updated successfully");
  }
);

export const removeItemFromCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await checkoutItemRepository.deleteById(req.params.checkoutItemID);
    if (result.deletedCount === 0) throw ApiError.notFound("Checkout item not found");
    sendResponse(res, HTTP_STATUS.OK, "Item removed from checkout successfully");
  }
);
