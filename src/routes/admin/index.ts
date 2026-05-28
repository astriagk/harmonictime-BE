import { Router } from "express";
import { roleRouter } from "../../modules/users/role";
import { adminUserRouter } from "../../modules/users/user";
import { genericRouter } from "../../modules/generic";
import { adminWithdrawalRouter } from "../../modules/wallet/withdrawal";
import { adminGSTRouter } from "../../modules/users/gst";
import adminProductRouter from "../../modules/catalog/product/product.admin.routes";
import sellerAdminRouter from "../../modules/users/user/seller.admin.routes";

// Admin surface: roles/user-roles management + generic seed helper + payouts + customer management.
const router: Router = Router();

router.use("/roles", roleRouter);
router.use("/generic", genericRouter);
router.use("/admin/withdrawals", adminWithdrawalRouter);
router.use("/admin/users", adminUserRouter);
router.use("/admin/gst", adminGSTRouter);
router.use("/admin/products", adminProductRouter);
router.use("/admin/sellers", sellerAdminRouter);

export default router;
