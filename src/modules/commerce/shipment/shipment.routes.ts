import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createShipment,
  getShipmentsByCheckout,
  getShipmentsBySeller,
  updateShipment,
  deleteShipment,
} from "./shipment.controller";
import { createShipmentSchema, updateShipmentSchema } from "./shipment.validation";

const router: Router = Router();

router.post("/", validate(createShipmentSchema), createShipment);
router.get("/checkout/:checkoutID", getShipmentsByCheckout);
router.get("/seller/:sellerID", getShipmentsBySeller);
router.put("/:shipmentID", validate(updateShipmentSchema), updateShipment);
router.delete("/:shipmentID", deleteShipment);

export default router;
