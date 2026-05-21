import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  getUserProfile,
} from "./user.controller";
import { updateUserSchema } from "./user.validation";

const router: Router = Router();

router.get("/profile", authMiddleware, getUserProfile);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", validate(updateUserSchema), updateUserById);
router.delete("/:id", deleteUserById);

export default router;
