import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createRole,
  getRoles,
  getRoleById,
  createUserRole,
  getUserRoles,
} from "./role.controller";
import { createRoleSchema, createUserRoleSchema } from "./role.validation";

const router: Router = Router();

router.post("/", validate(createRoleSchema), createRole);
router.get("/", getRoles);
router.get("/:roleID", getRoleById);
router.post("/user-roles", validate(createUserRoleSchema), createUserRole);
router.get("/user-roles/:userId", getUserRoles);

export default router;
