import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createSiteContent,
  getSiteContent,
  getSiteContentById,
  updateSiteContent,
  deleteSiteContent,
} from "./site_content.controller";
import {
  createSiteContentSchema,
  updateSiteContentSchema,
} from "./site_content.validation";

const router: Router = Router();

router.post("/", validate(createSiteContentSchema), createSiteContent);
router.get("/", getSiteContent);
router.get("/:id", getSiteContentById);
router.put("/:id", validate(updateSiteContentSchema), updateSiteContent);
router.delete("/:id", deleteSiteContent);

export default router;
