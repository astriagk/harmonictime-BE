import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createProductDetails,
  getProductDetailsByProductID,
  updateProductDetails,
  deleteProductDetails,
} from "./product_details.controller";
import {
  createProductDetailsSchema,
  updateProductDetailsSchema,
} from "./product_details.validation";

const router: Router = Router();

router.post("/", validate(createProductDetailsSchema), createProductDetails);
router.get("/:productID", getProductDetailsByProductID);
router.put("/:productID", validate(updateProductDetailsSchema), updateProductDetails);
router.delete("/:productID", deleteProductDetails);

export default router;
