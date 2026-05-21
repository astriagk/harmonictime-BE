import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createOffer,
  getOfferById,
  getAllActiveOffers,
  updateOffer,
  deleteOffer,
} from "./offer.controller";
import { createOfferSchema, updateOfferSchema } from "./offer.validation";

const router: Router = Router();

router.post("/", validate(createOfferSchema), createOffer);
router.get("/", getAllActiveOffers);
router.get("/:offerID", getOfferById);
router.put("/:offerID", validate(updateOfferSchema), updateOffer);
router.delete("/:offerID", deleteOffer);

export default router;
