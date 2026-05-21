import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createStrapMaterial,
  getAllStrapMaterials,
  getStrapMaterialById,
  updateStrapMaterial,
  deleteStrapMaterial,
} from "./strapMaterial.controller";
import { createStrapMaterialSchema, updateStrapMaterialSchema } from "./strapMaterial.validation";

const router: Router = Router();

router.post("/", validate(createStrapMaterialSchema), createStrapMaterial);
router.get("/", getAllStrapMaterials);
router.get("/:strapMaterialID", getStrapMaterialById);
router.put("/:strapMaterialID", validate(updateStrapMaterialSchema), updateStrapMaterial);
router.delete("/:strapMaterialID", deleteStrapMaterial);

export default router;
