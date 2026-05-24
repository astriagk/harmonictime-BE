import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createBankAccount,
  getBankAccounts,
  updateBankAccount,
  deleteBankAccount,
  verifyBankAccount,
} from "./bank_account.controller";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
} from "./bank_account.validation";

// Mounted at /bank-accounts. Seller-only; ownership scoped to the JWT.
const router: Router = Router();

router.post("/", authMiddleware, validate(createBankAccountSchema), createBankAccount);
router.get("/", authMiddleware, getBankAccounts);
router.put("/:accountID", authMiddleware, validate(updateBankAccountSchema), updateBankAccount);
router.delete("/:accountID", authMiddleware, deleteBankAccount);
router.post("/:accountID/verify", authMiddleware, verifyBankAccount);

export default router;
