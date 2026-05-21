import { Router } from "express";
import { roleRouter } from "../../modules/users/role";
import { genericRouter } from "../../modules/generic";

// Admin surface: roles/user-roles management + generic seed helper.
const router: Router = Router();

router.use("/roles", roleRouter);
router.use("/generic", genericRouter);

export default router;
