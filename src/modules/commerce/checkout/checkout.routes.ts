import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createCheckout,
  getCheckoutById,
  getAllCheckoutsByUserID,
  getOrdersBySeller,
  updateCheckoutStatus,
  updateSellerApproval,
  deleteCheckout,
} from "./checkout.controller";
import {
  createCheckoutSchema,
  updateCheckoutStatusSchema,
  sellerApprovalSchema,
} from "./checkout.validation";

const router: Router = Router();

router.post("/", validate(createCheckoutSchema), createCheckout);
router.get("/user/:userID", getAllCheckoutsByUserID);
router.get("/seller/:sellerID", getOrdersBySeller);
router.put("/seller/:sellerID/order/:checkoutID/approval", validate(sellerApprovalSchema), updateSellerApproval);
router.get("/:checkoutID", getCheckoutById);
router.put("/:checkoutID/status", validate(updateCheckoutStatusSchema), updateCheckoutStatus);
router.delete("/:checkoutID", deleteCheckout);

export default router;
