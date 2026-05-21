import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
} from "./collection.controller";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "./collection.validation";

const router: Router = Router();

router.post("/", validate(createCollectionSchema), createCollection);
router.get("/", getAllCollections);
router.get("/:collectionID", getCollectionById);
router.put("/:collectionID", validate(updateCollectionSchema), updateCollection);
router.delete("/:collectionID", deleteCollection);

export default router;
