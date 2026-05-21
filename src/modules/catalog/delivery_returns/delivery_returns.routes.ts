import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createDeliveryReturn,
  getDeliveryReturnById,
  getAllDeliveryReturnsByProductID,
  updateDeliveryReturn,
  deleteDeliveryReturn,
} from "./delivery_returns.controller";
import {
  createDeliveryReturnSchema,
  updateDeliveryReturnSchema,
} from "./delivery_returns.validation";

const router: Router = Router();

router.post("/", validate(createDeliveryReturnSchema), createDeliveryReturn);
router.get("/product/:productID", getAllDeliveryReturnsByProductID);
router.get("/:deliveryReturnID", getDeliveryReturnById);
router.put("/product/:productID", validate(updateDeliveryReturnSchema), updateDeliveryReturn);
// Alias so updating by product id matches product-details / product-descriptions.
router.put("/:productID", validate(updateDeliveryReturnSchema), updateDeliveryReturn);
router.delete("/:deliveryReturnID", deleteDeliveryReturn);

export default router;
