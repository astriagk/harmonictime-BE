import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createRecipient,
  getAllRecipients,
  getRecipientById,
  updateRecipient,
  deleteRecipient,
} from "./recipient.controller";
import { createRecipientSchema, updateRecipientSchema } from "./recipient.validation";

const router: Router = Router();

router.post("/", validate(createRecipientSchema), createRecipient);
router.get("/", getAllRecipients);
router.get("/:recipientID", getRecipientById);
router.put("/:recipientID", validate(updateRecipientSchema), updateRecipient);
router.delete("/:recipientID", deleteRecipient);

export default router;
