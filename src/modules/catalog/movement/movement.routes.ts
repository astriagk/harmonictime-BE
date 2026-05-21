import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createMovement,
  getAllMovements,
  getMovementById,
  updateMovement,
  deleteMovement,
} from "./movement.controller";
import { createMovementSchema, updateMovementSchema } from "./movement.validation";

const router: Router = Router();

router.post("/", validate(createMovementSchema), createMovement);
router.get("/", getAllMovements);
router.get("/:movementID", getMovementById);
router.put("/:movementID", validate(updateMovementSchema), updateMovement);
router.delete("/:movementID", deleteMovement);

export default router;
