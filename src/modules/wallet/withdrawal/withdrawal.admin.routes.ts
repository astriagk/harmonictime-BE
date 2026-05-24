import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { requireAdmin } from "../../../shared/middlewares/requireAdmin.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  listWithdrawals,
  payWithdrawal,
  rejectWithdrawal,
} from "./withdrawal.controller";
import {
  payWithdrawalSchema,
  rejectWithdrawalSchema,
} from "./withdrawal.validation";

// Mounted at /admin/withdrawals. Admin-only payout management.
const router: Router = Router();

router.use(authMiddleware, requireAdmin);

router.get("/", listWithdrawals);
router.put("/:withdrawalID/pay", validate(payWithdrawalSchema), payWithdrawal);
router.put("/:withdrawalID/reject", validate(rejectWithdrawalSchema), rejectWithdrawal);

export default router;
