import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createAddress,
  getAddressById,
  getAllAddressesByUserID,
  updateAddress,
  deleteAddress,
} from "./address.controller";
import { createAddressSchema, updateAddressSchema } from "./address.validation";

const router: Router = Router();

router.post("/", validate(createAddressSchema), createAddress);
// distinct paths fix the old /:addressID vs /:userID collision
router.get("/user/:userID", getAllAddressesByUserID);
router.get("/:addressID", getAddressById);
router.put("/:addressID", validate(updateAddressSchema), updateAddress);
router.delete("/:addressID", deleteAddress);

export default router;
