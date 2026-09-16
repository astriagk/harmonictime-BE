import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { requireAdmin } from "../../../shared/middlewares/requireAdmin.middleware";
import {
  listYoutubeVideos,
  adminListYoutubeVideos,
  createYoutubeVideo,
  updateYoutubeVideo,
  deleteYoutubeVideo,
} from "./youtube_video.controller";
import {
  createYoutubeVideoSchema,
  updateYoutubeVideoSchema,
} from "./youtube_video.validation";

// Mounted at /api/youtube-videos. "admin/list" must be declared before /:id or
// Express would match it as an id.
const router: Router = Router();

router.get("/", listYoutubeVideos);
router.get("/admin/list", authMiddleware, requireAdmin, adminListYoutubeVideos);

router.post("/", authMiddleware, requireAdmin, validate(createYoutubeVideoSchema), createYoutubeVideo);
router.put("/:id", authMiddleware, requireAdmin, validate(updateYoutubeVideoSchema), updateYoutubeVideo);
router.delete("/:id", authMiddleware, requireAdmin, deleteYoutubeVideo);

export default router;
