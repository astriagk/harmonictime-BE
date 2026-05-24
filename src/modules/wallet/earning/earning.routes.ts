import { Router } from "express";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { getWallet, getWalletItems } from "./earning.controller";

// Mounted at /wallet. Seller-only — the seller is taken from the JWT.
const router: Router = Router();

router.get("/", authMiddleware, getWallet);
router.get("/items", authMiddleware, getWalletItems);

export default router;
