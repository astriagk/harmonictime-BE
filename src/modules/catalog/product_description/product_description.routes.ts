import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createProductDescription,
  getAllProductDescriptions,
  getProductDescriptionByProductID,
  updateProductDescription,
  deleteProductDescription,
} from "./product_description.controller";
import {
  createProductDescriptionSchema,
  updateProductDescriptionSchema,
} from "./product_description.validation";

const router: Router = Router();

router.post("/", validate(createProductDescriptionSchema), createProductDescription);
router.get("/", getAllProductDescriptions);
router.get("/:productID", getProductDescriptionByProductID);
router.put("/:productID", validate(updateProductDescriptionSchema), updateProductDescription);
router.delete("/:productID", deleteProductDescription);

export default router;
