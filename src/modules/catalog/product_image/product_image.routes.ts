import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createProductImage,
  getProductImageById,
  getAllProductImagesByProductID,
  updateProductImage,
  deleteProductImage,
} from "./product_image.controller";
import {
  createProductImageSchema,
  updateProductImageSchema,
} from "./product_image.validation";

const router: Router = Router();

router.post("/", validate(createProductImageSchema), createProductImage);
// distinct paths avoid the old /:imageID vs /:productID route collision
router.get("/product/:productID", getAllProductImagesByProductID);
router.get("/:imageID", getProductImageById);
router.put("/:imageID", validate(updateProductImageSchema), updateProductImage);
router.delete("/:imageID", deleteProductImage);

export default router;
