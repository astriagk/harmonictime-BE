import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { requireAdmin } from "../../../shared/middlewares/requireAdmin.middleware";
import {
  listCustomers,
  getCustomer,
  blockUser,
  unblockUser,
  suspendUser,
} from "./user.admin.controller";

// Mounted at /admin/users. Admin-only customer management.
const router: Router = Router();

router.use(authMiddleware, requireAdmin);

router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.put("/:id/block", blockUser);
router.put("/:id/unblock", unblockUser);
router.put("/:id/suspend", suspendUser);

export default router;
