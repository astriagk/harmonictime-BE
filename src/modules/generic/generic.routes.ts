import { Router } from "express";
import { createCollectionItems } from "./generic.controller";

const router: Router = Router();

router.post("/", createCollectionItems);

export default router;
