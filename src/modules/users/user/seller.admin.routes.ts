import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import {
  adminListSellers,
  adminGetSellerProfile,
  adminApproveSeller,
  adminRejectSeller,
  adminRequestSellerInfo,
} from "./seller.admin.controller";

// Mounted at /admin/sellers
const router: Router = Router();

router.get("/", authMiddleware, adminListSellers);
router.get("/:sellerID", authMiddleware, adminGetSellerProfile);
router.put("/:sellerID/approve", authMiddleware, adminApproveSeller);
router.put("/:sellerID/reject", authMiddleware, adminRejectSeller);
router.put("/:sellerID/request-info", authMiddleware, adminRequestSellerInfo);

export default router;
