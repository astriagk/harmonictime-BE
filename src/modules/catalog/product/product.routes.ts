import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  editProduct,
  deleteProduct,
} from "./product.controller";
import {
  createProductSchema,
  updateAvailabilitySchema,
  updateProductSchema,
} from "./product.validation";

const router: Router = Router();

router.post("/", validate(createProductSchema), createProduct);
router.get("/", getAllProducts);
router.get("/:productID", getProductById);
router.put("/availability", validate(updateAvailabilitySchema), updateProduct);
router.put("/:productID", validate(updateProductSchema), editProduct);
router.delete("/:productID", deleteProduct);

export default router;
