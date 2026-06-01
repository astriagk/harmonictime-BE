import { Router } from "express";
import { uploadMiddleware } from "../../shared/middlewares/multer.middleware";
import { authMiddleware } from "../../shared/middlewares/auth.middleware";
import {
  uploadImages,
  uploadSingleImage,
  uploadGSTDocuments,
  deleteImage,
} from "./file-upload.controller";

// Mounted at /upload. Multer (memory storage) must run before the handler so
// `req.files` carries the buffers the S3 service uploads.
const router: Router = Router();

router.post("/images", uploadMiddleware.array("images", 10), uploadImages);
router.post("/image", uploadMiddleware.single("image"), uploadSingleImage);
router.post(
  "/gst-documents",
  authMiddleware,
  uploadMiddleware.array("documents", 5),
  uploadGSTDocuments
);
router.delete("/images/:imageId", deleteImage);

export default router;
