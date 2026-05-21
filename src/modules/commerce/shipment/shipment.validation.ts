import Joi from "joi";

const STATUSES = ["Pending", "Shipped", "InTransit", "OutForDelivery", "Delivered"];

export const createShipmentSchema = Joi.object({
  CheckoutID: Joi.string().required(),
  SellerID: Joi.string().required(),
  Courier: Joi.string().required(),
  TrackingNumber: Joi.string().required(),
  TrackingURL: Joi.string().uri().allow("").optional(),
  ShipmentStatus: Joi.string().valid(...STATUSES).optional(),
  ShippedAt: Joi.date().optional(),
  EstimatedDelivery: Joi.date().optional(),
  Notes: Joi.string().allow("").optional(),
});

export const updateShipmentSchema = Joi.object({
  Courier: Joi.string().optional(),
  TrackingNumber: Joi.string().optional(),
  TrackingURL: Joi.string().uri().allow("").optional(),
  ShipmentStatus: Joi.string().valid(...STATUSES).optional(),
  ShippedAt: Joi.date().optional(),
  EstimatedDelivery: Joi.date().optional(),
  DeliveredAt: Joi.date().optional(),
  Notes: Joi.string().allow("").optional(),
}).min(1);
