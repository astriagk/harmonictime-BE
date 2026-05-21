import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  addRecentlyViewedProduct,
  getRecentlyViewedProductsByUserID,
  deleteRecentlyViewedProduct,
} from "./recently_viewed.controller";
import { addRecentlyViewedSchema } from "./recently_viewed.validation";

const router: Router = Router();

router.post("/", validate(addRecentlyViewedSchema), addRecentlyViewedProduct);
router.get("/user/:userID", getRecentlyViewedProductsByUserID);
router.delete("/:viewID", deleteRecentlyViewedProduct);

export default router;
