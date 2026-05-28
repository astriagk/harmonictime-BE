import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createGSTDetails,
  getGSTDetails,
  updateGSTDetails,
  deleteGSTDetails,
  adminListGSTDetails,
  adminVerifyGSTDetails,
} from "./gst.controller";
import { createGSTSchema, updateGSTSchema } from "./gst.validation";

export const sellerGSTRouter: Router = Router();
export const adminGSTRouter: Router = Router();

// Seller routes — mounted at /gst
sellerGSTRouter.post("/", authMiddleware, validate(createGSTSchema), createGSTDetails);
sellerGSTRouter.get("/", authMiddleware, getGSTDetails);
sellerGSTRouter.put("/:id", authMiddleware, validate(updateGSTSchema), updateGSTDetails);
sellerGSTRouter.delete("/:id", authMiddleware, deleteGSTDetails);

// Admin routes — mounted at /gst
adminGSTRouter.get("/", authMiddleware, adminListGSTDetails);
adminGSTRouter.put("/:id/verify", authMiddleware, adminVerifyGSTDetails);
