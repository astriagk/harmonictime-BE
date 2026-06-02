import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createShipment,
  getShipmentsByCheckout,
  getShipmentsBySeller,
  updateShipment,
  deleteShipment,
  getShipmentTracking,
  handleTrackingWebhook,
} from "./shipment.controller";
import { createShipmentSchema, updateShipmentSchema } from "./shipment.validation";

const router: Router = Router();

// Webhook must be declared before auth middleware is applied by the parent router
router.post("/webhook/tracking", handleTrackingWebhook);

router.post("/", validate(createShipmentSchema), createShipment);
router.get("/checkout/:checkoutID", getShipmentsByCheckout);
router.get("/seller/:sellerID", getShipmentsBySeller);
router.get("/:shipmentID/track", getShipmentTracking);
router.put("/:shipmentID", validate(updateShipmentSchema), updateShipment);
router.delete("/:shipmentID", deleteShipment);

export default router;
