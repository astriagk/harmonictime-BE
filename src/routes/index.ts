import { Router } from "express";
import authGateway from "./auth";
import publicGateway from "./public";
import customerGateway from "./customer";
import sellerGateway from "./seller";
import adminGateway from "./admin";

// All gateways mount under /api. Each gateway groups the module routers that
// belong to one consumer surface.
const router: Router = Router();

router.use("/", authGateway);
router.use("/", publicGateway);
router.use("/", customerGateway);
router.use("/", sellerGateway);
router.use("/", adminGateway);

export default router;
