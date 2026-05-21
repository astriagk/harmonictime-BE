import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "./category.controller";
import { createCategorySchema, updateCategorySchema } from "./category.validation";

const router: Router = Router();

router.post("/", validate(createCategorySchema), createCategory);
router.get("/", getAllCategories);
router.get("/:categoryID", getCategoryById);
router.put("/:categoryID", validate(updateCategorySchema), updateCategory);
router.delete("/:categoryID", deleteCategory);

export default router;
