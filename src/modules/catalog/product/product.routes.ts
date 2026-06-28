import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import { authMiddleware, optionalAuthMiddleware } from "../../../shared/middlewares/auth.middleware";
import { requireApprovedSeller } from "../../../shared/middlewares/requireApprovedSeller.middleware";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  editProduct,
  bulkUpdateProductOffer,
  deleteProduct,
  checkAvailability,
  searchProducts,
} from "./product.controller";
import {
  createProductSchema,
  updateAvailabilitySchema,
  updateProductSchema,
  bulkOfferSchema,
  checkAvailabilitySchema,
} from "./product.validation";

const router: Router = Router();

const sellerGuard = [authMiddleware, requireApprovedSeller];

router.post("/", ...sellerGuard, validate(createProductSchema), createProduct);
router.post("/check-availability", validate(checkAvailabilitySchema), checkAvailability);
router.get("/", getAllProducts);
// Must be registered before "/:productID" so "search" isn't captured as an id.
router.get("/search", searchProducts);
router.get("/:productID", optionalAuthMiddleware, getProductById);
router.put("/availability", ...sellerGuard, validate(updateAvailabilitySchema), updateProduct);
router.put("/bulk-offer", ...sellerGuard, validate(bulkOfferSchema), bulkUpdateProductOffer);
router.put("/:productID", ...sellerGuard, validate(updateProductSchema), editProduct);
router.delete("/:productID", ...sellerGuard, deleteProduct);

export default router;
