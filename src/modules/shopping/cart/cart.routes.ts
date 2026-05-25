import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  addProductToCart,
  getCartByUserID,
  getCartItemByProduct,
  updateCartProductQuantity,
  removeProductFromCart,
} from "./cart.controller";
import { addToCartSchema, updateQuantitySchema } from "./cart.validation";

const router: Router = Router();

router.post("/", validate(addToCartSchema), addProductToCart);
router.get("/user/:userID", getCartByUserID);
router.get("/user/:userID/:productID", getCartItemByProduct);
router.put("/:cartID", validate(updateQuantitySchema), updateCartProductQuantity);
router.delete("/:cartID", removeProductFromCart);

export default router;
