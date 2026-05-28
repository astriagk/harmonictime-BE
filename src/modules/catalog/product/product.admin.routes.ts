import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import {
  adminListProducts,
  adminApproveProduct,
  adminRejectProduct,
} from "./product.admin.controller";

// Mounted at /admin/products
const router: Router = Router();

router.get("/", authMiddleware, adminListProducts);
router.put("/:productID/approve", authMiddleware, adminApproveProduct);
router.put("/:productID/reject", authMiddleware, adminRejectProduct);

export default router;
