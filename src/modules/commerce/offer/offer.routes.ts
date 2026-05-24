import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createOffer,
  getOfferById,
  getAllActiveOffers,
  getAllOffers,
  setOfferStatus,
  updateOffer,
  deleteOffer,
} from "./offer.controller";
import {
  createOfferSchema,
  updateOfferSchema,
  toggleOfferStatusSchema,
} from "./offer.validation";

const router: Router = Router();

router.post("/", validate(createOfferSchema), createOffer);
router.get("/", getAllActiveOffers);
// Static path — must precede "/:offerID" so "all" isn't treated as an id.
router.get("/all", getAllOffers);
router.get("/:offerID", getOfferById);
router.patch(
  "/:offerID/status",
  validate(toggleOfferStatusSchema),
  setOfferStatus
);
router.put("/:offerID", validate(updateOfferSchema), updateOffer);
router.delete("/:offerID", deleteOffer);

export default router;
