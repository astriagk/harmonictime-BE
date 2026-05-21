import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { shipmentRepository } from "./shipment.repository";
import { checkoutRepository } from "../checkout/checkout.repository";
import { userRepository } from "../../users/user/user.repository";

// A shipment's status maps onto the parent checkout's DeliveryStatus so buyers
// see consistent state without querying the shipment directly.
const DELIVERY_STATUS: Record<string, string> = {
  Pending: "Processing",
  Shipped: "Shipped",
  InTransit: "Shipped",
  OutForDelivery: "Shipped",
  Delivered: "Delivered",
};

export const createShipment = asyncHandler(async (req: Request, res: Response) => {
  const { CheckoutID, SellerID, ShipmentStatus, ShippedAt, EstimatedDelivery, ...rest } =
    req.body;

  if (!(await checkoutRepository.findById(CheckoutID)))
    throw ApiError.badRequest("Invalid CheckoutID");
  if (!(await userRepository.findById(SellerID)))
    throw ApiError.badRequest("Invalid SellerID");

  const status = ShipmentStatus || "Pending";
  const result = await shipmentRepository.insertOne({
    CheckoutID: new ObjectId(CheckoutID),
    SellerID: new ObjectId(SellerID),
    ShipmentStatus: status,
    ShippedAt: ShippedAt ? new Date(ShippedAt) : undefined,
    EstimatedDelivery: EstimatedDelivery ? new Date(EstimatedDelivery) : undefined,
    CreatedAt: new Date(),
    ...rest,
  });

  await checkoutRepository.updateById(CheckoutID, {
    DeliveryStatus: DELIVERY_STATUS[status],
  } as any);

  sendResponse(res, HTTP_STATUS.CREATED, "Shipment created successfully", result);
});

export const getShipmentsByCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await shipmentRepository.findByCheckout(req.params.checkoutID);
    sendResponse(res, HTTP_STATUS.OK, "Shipments retrieved successfully", items);
  }
);

export const getShipmentsBySeller = asyncHandler(
  async (req: Request, res: Response) => {
    const items = await shipmentRepository.findBySeller(req.params.sellerID);
    sendResponse(res, HTTP_STATUS.OK, "Shipments retrieved successfully", items);
  }
);

export const updateShipment = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentRepository.findById(req.params.shipmentID);
  if (!shipment) throw ApiError.notFound("Shipment not found");

  await shipmentRepository.updateById(req.params.shipmentID, req.body);

  if (req.body.ShipmentStatus) {
    await checkoutRepository.updateById(shipment.CheckoutID, {
      DeliveryStatus: DELIVERY_STATUS[req.body.ShipmentStatus],
    } as any);
  }
  sendResponse(res, HTTP_STATUS.OK, "Shipment updated successfully");
});

export const deleteShipment = asyncHandler(async (req: Request, res: Response) => {
  const result = await shipmentRepository.deleteById(req.params.shipmentID);
  if (result.deletedCount === 0) throw ApiError.notFound("Shipment not found");
  sendResponse(res, HTTP_STATUS.OK, "Shipment deleted successfully");
});
