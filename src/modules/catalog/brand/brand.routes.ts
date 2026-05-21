import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createBrand,
  createMultipleBrands,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} from "./brand.controller";
import {
  createBrandSchema,
  createMultipleBrandsSchema,
  updateBrandSchema,
} from "./brand.validation";

const router: Router = Router();

router.post("/", validate(createBrandSchema), createBrand);
router.post("/bulk", validate(createMultipleBrandsSchema), createMultipleBrands);
router.get("/", getAllBrands);
router.get("/:brandID", getBrandById);
router.put("/:brandID", validate(updateBrandSchema), updateBrand);
router.delete("/:brandID", deleteBrand);

export default router;
