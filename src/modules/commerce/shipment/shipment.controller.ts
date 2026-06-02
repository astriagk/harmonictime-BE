import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { shipmentRepository } from "./shipment.repository";
import { checkoutRepository } from "../checkout/checkout.repository";
import { userRepository } from "../../users/user/user.repository";
import { trackingService } from "../../../shared/services/tracking.service";
import { env } from "../../../shared/config/env";

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
  // DeliveredAt is intentionally pulled out and ignored — it's stamped
  // server-side below so a client can't backdate/forge payout eligibility.
  const {
    CheckoutID,
    SellerID,
    ShipmentStatus,
    ShippedAt,
    EstimatedDelivery,
    DeliveredAt: _ignoredDeliveredAt,
    ...rest
  } = req.body;

  if (!(await checkoutRepository.findById(CheckoutID)))
    throw ApiError.badRequest("Invalid CheckoutID");
  if (!(await userRepository.findById(SellerID)))
    throw ApiError.badRequest("Invalid SellerID");

  const status = ShipmentStatus || "Pending";
  // Stamp lifecycle timestamps server-side from the status, so wallet payout
  // eligibility (which keys off DeliveredAt) never depends on the client. A
  // shipment created directly as Shipped/Delivered still gets the right marks.
  const now = new Date();
  const shippedAt = ShippedAt
    ? new Date(ShippedAt)
    : status === "Shipped" || status === "Delivered"
      ? now
      : undefined;
  const deliveredAt = status === "Delivered" ? now : undefined;

  const result = await shipmentRepository.insertOne({
    CheckoutID: new ObjectId(CheckoutID),
    SellerID: new ObjectId(SellerID),
    ShipmentStatus: status,
    ShippedAt: shippedAt,
    EstimatedDelivery: EstimatedDelivery ? new Date(EstimatedDelivery) : undefined,
    DeliveredAt: deliveredAt,
    CreatedAt: now,
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

  // Never let the client set delivery timestamps — they gate wallet payouts.
  const { DeliveredAt: _ignoredDeliveredAt, ShippedAt: _ignoredShippedAt, ...update } =
    req.body as Record<string, unknown>;

  // Stamp lifecycle timestamps server-side when the status transitions, so the
  // wallet's delivery-based payout eligibility fires without relying on the client.
  const now = new Date();
  if (req.body.ShipmentStatus === "Delivered" && !shipment.DeliveredAt) {
    update.DeliveredAt = now;
    if (!shipment.ShippedAt) update.ShippedAt = now;
  } else if (req.body.ShipmentStatus === "Shipped" && !shipment.ShippedAt) {
    update.ShippedAt = now;
  }

  await shipmentRepository.updateById(req.params.shipmentID, update);

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

export const getShipmentTracking = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentRepository.findById(req.params.shipmentID);
  if (!shipment) throw ApiError.notFound("Shipment not found");
  if (!shipment.TrackingNumber) throw ApiError.badRequest("No tracking number on this shipment");

  const result = await trackingService.fetchTracking(shipment.TrackingNumber, shipment.Courier);

  await shipmentRepository.updateById(req.params.shipmentID, {
    TrackingEvents: result.Events,
    LastTrackedAt: new Date(),
    TrackingProvider: "TrackingMore",
  } as any);

  sendResponse(res, HTTP_STATUS.OK, "Tracking fetched successfully", result);
});

// Shiprocket pushes a POST to this endpoint on every scan event.
// No JWT auth — verified via shared webhook secret header instead.
export const handleTrackingWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = req.headers["x-trackingmore-secret"] ?? req.headers["x-webhook-secret"];
  if (env.TRACKING_WEBHOOK_SECRET && secret !== env.TRACKING_WEBHOOK_SECRET) {
    throw ApiError.unauthorized("Invalid webhook secret");
  }

  const body = req.body as Record<string, unknown>;
  const awb = trackingService.getWebhookAwb(body);
  if (!awb) {
    res.status(HTTP_STATUS.OK).json({ received: true });
    return;
  }

  const shipment = await shipmentRepository.findByTrackingNumber(awb);
  if (!shipment) {
    res.status(HTTP_STATUS.OK).json({ received: true });
    return;
  }

  const event = trackingService.parseWebhookPayload(body);
  const now = new Date();
  const existingEvents = shipment.TrackingEvents ?? [];
  const updatedEvents = [...existingEvents, event];

  const patch: Record<string, unknown> = {
    TrackingEvents: updatedEvents,
    LastTrackedAt: now,
    TrackingProvider: "Shiprocket",
  };

  if (trackingService.isDeliveredEvent(event) && !shipment.DeliveredAt) {
    patch.ShipmentStatus = "Delivered";
    patch.DeliveredAt = now;
    if (!shipment.ShippedAt) patch.ShippedAt = now;

    await checkoutRepository.updateById(shipment.CheckoutID, {
      DeliveryStatus: DELIVERY_STATUS["Delivered"],
    } as any);
  }

  await shipmentRepository.updateById(shipment._id!, patch);

  res.status(HTTP_STATUS.OK).json({ received: true });
});
