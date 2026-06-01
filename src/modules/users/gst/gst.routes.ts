import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import { uploadMiddleware } from "../../../shared/middlewares/multer.middleware";
import {
  createGSTDetails,
  createGSTWithDocuments,
  getGSTDetails,
  updateGSTDetails,
  updateGSTWithDocuments,
  deleteGSTDetails,
  adminListGSTDetails,
  adminVerifyGSTDetails,
} from "./gst.controller";
import { createGSTSchema, updateGSTSchema } from "./gst.validation";

export const sellerGSTRouter: Router = Router();
export const adminGSTRouter: Router = Router();

// Seller routes — mounted at /gst
// Use /with-documents when submitting files + text fields together (multipart).
// Use plain POST/PUT when documents were uploaded separately via /api/upload/gst-documents.
sellerGSTRouter.post(
  "/",
  authMiddleware,
  validate(createGSTSchema),
  createGSTDetails,
);
sellerGSTRouter.post(
  "/with-documents",
  authMiddleware,
  uploadMiddleware.array("documents", 5),
  createGSTWithDocuments,
);
sellerGSTRouter.get("/", authMiddleware, getGSTDetails);
sellerGSTRouter.put(
  "/:id",
  authMiddleware,
  validate(updateGSTSchema),
  updateGSTDetails,
);
sellerGSTRouter.put(
  "/:id/with-documents",
  authMiddleware,
  uploadMiddleware.array("documents", 5),
  updateGSTWithDocuments,
);
sellerGSTRouter.delete("/:id", authMiddleware, deleteGSTDetails);

// Admin routes — mounted at /gst
adminGSTRouter.get("/", authMiddleware, adminListGSTDetails);
adminGSTRouter.put("/:id/verify", authMiddleware, adminVerifyGSTDetails);
