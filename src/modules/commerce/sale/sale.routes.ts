import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createSale,
  getSaleById,
  getAllSalesByUserID,
  deleteSale,
} from "./sale.controller";
import { createSaleSchema } from "./sale.validation";

const router: Router = Router();

router.post("/", validate(createSaleSchema), createSale);
router.get("/user/:userID", getAllSalesByUserID);
router.get("/:saleID", getSaleById);
router.delete("/:saleID", deleteSale);

export default router;
