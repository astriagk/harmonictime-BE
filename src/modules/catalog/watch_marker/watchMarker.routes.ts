import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createWatchMarker,
  getAllWatchMarkers,
  getWatchMarkerById,
  updateWatchMarker,
  deleteWatchMarker,
} from "./watchMarker.controller";
import { createWatchMarkerSchema, updateWatchMarkerSchema } from "./watchMarker.validation";

const router: Router = Router();

router.post("/", validate(createWatchMarkerSchema), createWatchMarker);
router.get("/", getAllWatchMarkers);
router.get("/:watchMarkerID", getWatchMarkerById);
router.put("/:watchMarkerID", validate(updateWatchMarkerSchema), updateWatchMarker);
router.delete("/:watchMarkerID", deleteWatchMarker);

export default router;
