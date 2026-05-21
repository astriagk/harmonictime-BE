import { Router } from "express";
import { productRouter } from "../../modules/catalog/product";
import { productDescriptionRouter } from "../../modules/catalog/product_description";
import { productDetailsRouter } from "../../modules/catalog/product_details";
import { productImageRouter } from "../../modules/catalog/product_image";
import { deliveryReturnsRouter } from "../../modules/catalog/delivery_returns";
import { brandRouter } from "../../modules/catalog/brand";
import { collectionRouter } from "../../modules/catalog/collection";
import { categoryRouter } from "../../modules/catalog/category";
import { recipientRouter } from "../../modules/catalog/recipient";
import { dialColorRouter } from "../../modules/catalog/dial_color";
import { movementRouter } from "../../modules/catalog/movement";
import { strapMaterialRouter } from "../../modules/catalog/strap_material";
import { caseMaterialRouter } from "../../modules/catalog/case_material";
import { watchMarkerRouter } from "../../modules/catalog/watch_marker";
import { deliveryOptionRouter } from "../../modules/catalog/delivery_option";
import { offerRouter } from "../../modules/commerce/offer";
import { reviewRouter } from "../../modules/catalog/review";

// Catalog browse + reference data + active offers.
const router: Router = Router();

router.use("/products", productRouter);
router.use("/product-descriptions", productDescriptionRouter);
router.use("/product-details", productDetailsRouter);
router.use("/product-images", productImageRouter);
router.use("/delivery-returns", deliveryReturnsRouter);
router.use("/brands", brandRouter);
router.use("/collections", collectionRouter);
router.use("/categories", categoryRouter);
router.use("/recipients", recipientRouter);
router.use("/dial-colors", dialColorRouter);
router.use("/movements", movementRouter);
router.use("/strap-materials", strapMaterialRouter);
router.use("/case-materials", caseMaterialRouter);
router.use("/watch-markers", watchMarkerRouter);
router.use("/delivery-options", deliveryOptionRouter);
router.use("/offers", offerRouter);
router.use("/reviews", reviewRouter);

export default router;
