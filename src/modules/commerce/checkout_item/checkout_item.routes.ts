import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  addItemToCheckout,
  getCheckoutItemsByCheckoutID,
  getAllCheckoutItems,
  updateCheckoutItemQuantity,
  removeItemFromCheckout,
} from "./checkout_item.controller";
import {
  addCheckoutItemSchema,
  updateCheckoutItemSchema,
} from "./checkout_item.validation";

const router: Router = Router();

router.post("/", validate(addCheckoutItemSchema), addItemToCheckout);
router.get("/", getAllCheckoutItems);
router.get("/checkout/:checkoutID", getCheckoutItemsByCheckoutID);
router.put("/:checkoutItemID", validate(updateCheckoutItemSchema), updateCheckoutItemQuantity);
router.delete("/:checkoutItemID", removeItemFromCheckout);

export default router;
