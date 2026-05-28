import { Router } from "express";
import { shipmentRouter } from "../../modules/commerce/shipment";
import { fileUploadRouter } from "../../modules/file-upload";
import { walletRouter } from "../../modules/wallet/earning";
import { bankAccountRouter } from "../../modules/wallet/bank_account";
import { withdrawalRouter } from "../../modules/wallet/withdrawal";
import { chatRouter } from "../../modules/chat";
import { sellerGSTRouter } from "../../modules/users/gst";

// Seller fulfilment surface: tracking + media upload + wallet/payouts.
// (Product listing CRUD is mounted under the public/catalog gateway.)
const router: Router = Router();

router.use("/shipments", shipmentRouter);
router.use("/upload", fileUploadRouter);
router.use("/wallet", walletRouter);
router.use("/bank-accounts", bankAccountRouter);
router.use("/withdrawals", withdrawalRouter);
router.use("/chat", chatRouter);
router.use("/gst", sellerGSTRouter);

export default router;
