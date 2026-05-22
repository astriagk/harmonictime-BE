import { Router } from "express";
import { validate } from "../../../shared/middlewares/validate.middleware";
import {
  createContactMessage,
  getContactMessages,
  getContactMessageById,
  markContactMessageRead,
  deleteContactMessage,
} from "./contact.controller";
import { createContactMessageSchema } from "./contact.validation";

const router: Router = Router();

router.post("/", validate(createContactMessageSchema), createContactMessage);
router.get("/", getContactMessages);
router.get("/:id", getContactMessageById);
router.patch("/:id/read", markContactMessageRead);
router.delete("/:id", deleteContactMessage);

export default router;
