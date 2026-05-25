import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  addProductToWishlist,
  getWishlistByUserID,
  removeProductFromWishlist,
  moveToCart,
} from "./wishlist.controller";
import { addToWishlistSchema } from "./wishlist.validation";

const router: Router = Router();

router.post("/", validate(addToWishlistSchema), addProductToWishlist);
router.get("/user/:userID", getWishlistByUserID);
router.post("/:wishlistID/move-to-cart", moveToCart);
router.delete("/:wishlistID", removeProductFromWishlist);

export default router;
