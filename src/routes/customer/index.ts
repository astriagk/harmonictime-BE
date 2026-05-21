import { Router } from "express";
import { userRouter } from "../../modules/users/user";
import { addressRouter } from "../../modules/users/address";
import { cartRouter } from "../../modules/shopping/cart";
import { wishlistRouter } from "../../modules/shopping/wishlist";
import { recentlyViewedRouter } from "../../modules/shopping/recently_viewed";
import { checkoutRouter } from "../../modules/commerce/checkout";
import { checkoutItemRouter } from "../../modules/commerce/checkout_item";
import { paymentRouter } from "../../modules/commerce/payment";
import { saleRouter } from "../../modules/commerce/sale";

// Authenticated buyer surface: account, shopping, checkout, payments, history.
const router: Router = Router();

router.use("/users", userRouter);
router.use("/address", addressRouter);
router.use("/cart", cartRouter);
router.use("/wishlist", wishlistRouter);
router.use("/recently-viewed", recentlyViewedRouter);
router.use("/checkout", checkoutRouter);
router.use("/checkout-items", checkoutItemRouter);
router.use("/payments", paymentRouter);
router.use("/sales", saleRouter);

export default router;
