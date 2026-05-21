import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createDeliveryOption,
  getAllDeliveryOptions,
  getDeliveryOptionById,
  updateDeliveryOption,
  deleteDeliveryOption,
} from "./deliveryOption.controller";
import { createDeliveryOptionSchema, updateDeliveryOptionSchema } from "./deliveryOption.validation";

const router: Router = Router();

router.post("/", validate(createDeliveryOptionSchema), createDeliveryOption);
router.get("/", getAllDeliveryOptions);
router.get("/:deliveryOptionID", getDeliveryOptionById);
router.put("/:deliveryOptionID", validate(updateDeliveryOptionSchema), updateDeliveryOption);
router.delete("/:deliveryOptionID", deleteDeliveryOption);

export default router;
