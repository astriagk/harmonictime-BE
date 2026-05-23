import { Router } from "express";
import { roleRouter } from "../../modules/users/role";
import { genericRouter } from "../../modules/generic";
import { adminWithdrawalRouter } from "../../modules/wallet/withdrawal";

// Admin surface: roles/user-roles management + generic seed helper + payouts.
const router: Router = Router();

router.use("/roles", roleRouter);
router.use("/generic", genericRouter);
router.use("/admin/withdrawals", adminWithdrawalRouter);

export default router;
