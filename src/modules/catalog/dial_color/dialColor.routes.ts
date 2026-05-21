import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createDialColor,
  getAllDialColors,
  getDialColorById,
  updateDialColor,
  deleteDialColor,
} from "./dialColor.controller";
import { createDialColorSchema, updateDialColorSchema } from "./dialColor.validation";

const router: Router = Router();

router.post("/", validate(createDialColorSchema), createDialColor);
router.get("/", getAllDialColors);
router.get("/:dialColorID", getDialColorById);
router.put("/:dialColorID", validate(updateDialColorSchema), updateDialColor);
router.delete("/:dialColorID", deleteDialColor);

export default router;
