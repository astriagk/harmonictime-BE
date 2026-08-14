import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../../shared/middlewares/auth.middleware";
import { requireAdmin } from "../../../shared/middlewares/requireAdmin.middleware";
import {
  listBlogs,
  listBlogCategories,
  getBlog,
  getRelatedBlogs,
  adminListBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
} from "./blog.controller";
import { createBlogSchema, updateBlogSchema } from "./blog.validation";

// Mounted at /api/blogs. Public reads first; the literal paths must be declared
// before /:slugOrId or Express matches "admin"/"categories" as a slug.
const router: Router = Router();

router.get("/", listBlogs);
router.get("/categories", listBlogCategories);
router.get("/admin/list", authMiddleware, requireAdmin, adminListBlogs);

router.post("/", authMiddleware, requireAdmin, validate(createBlogSchema), createBlog);
router.put("/:id", authMiddleware, requireAdmin, validate(updateBlogSchema), updateBlog);
router.delete("/:id", authMiddleware, requireAdmin, deleteBlog);

// Optional auth, not required auth: the public detail page calls this
// anonymously, while the admin edit screen calls it with a token to load a
// draft through the very same endpoint.
router.get("/:slugOrId", optionalAuthMiddleware, getBlog);
router.get("/:slugOrId/related", getRelatedBlogs);

export default router;
