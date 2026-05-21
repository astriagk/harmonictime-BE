import { Router } from "express";
import { shipmentRouter } from "../../modules/commerce/shipment";
import { fileUploadRouter } from "../../modules/file-upload";

// Seller fulfilment surface: tracking + media upload.
// (Product listing CRUD is mounted under the public/catalog gateway.)
const router: Router = Router();

router.use("/shipments", shipmentRouter);
router.use("/upload", fileUploadRouter);

export default router;
