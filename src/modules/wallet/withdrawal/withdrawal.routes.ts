import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  requestWithdrawal,
  getWithdrawals,
  cancelWithdrawal,
} from "./withdrawal.controller";
import { createWithdrawalSchema } from "./withdrawal.validation";

// Mounted at /withdrawals. Seller-only; seller taken from the JWT.
const router: Router = Router();

router.post("/", authMiddleware, validate(createWithdrawalSchema), requestWithdrawal);
router.get("/", authMiddleware, getWithdrawals);
router.put("/:withdrawalID/cancel", authMiddleware, cancelWithdrawal);

export default router;
