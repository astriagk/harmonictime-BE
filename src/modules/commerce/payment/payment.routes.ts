import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createOrder,
  verifyPayment,
  getPaymentsByCheckout,
} from "./payment.controller";
import { createOrderSchema, verifyPaymentSchema } from "./payment.validation";

const router: Router = Router();

router.post("/create-order", validate(createOrderSchema), createOrder);
router.post("/verify", validate(verifyPaymentSchema), verifyPayment);
router.get("/checkout/:checkoutID", getPaymentsByCheckout);

export default router;
