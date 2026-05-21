import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createCaseMaterial,
  getAllCaseMaterials,
  getCaseMaterialById,
  updateCaseMaterial,
  deleteCaseMaterial,
} from "./caseMaterial.controller";
import { createCaseMaterialSchema, updateCaseMaterialSchema } from "./caseMaterial.validation";

const router: Router = Router();

router.post("/", validate(createCaseMaterialSchema), createCaseMaterial);
router.get("/", getAllCaseMaterials);
router.get("/:caseMaterialID", getCaseMaterialById);
router.put("/:caseMaterialID", validate(updateCaseMaterialSchema), updateCaseMaterial);
router.delete("/:caseMaterialID", deleteCaseMaterial);

export default router;
