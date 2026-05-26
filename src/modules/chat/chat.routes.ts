import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.middleware";
import { authMiddleware } from "../../shared/middlewares/auth.middleware";
import {
  createOrGetThread,
  getMyThreads,
  getMessages,
  sendMessage,
  closeThread,
} from "./chat.controller";
import { createThreadSchema, sendMessageSchema } from "./chat.validation";

const router: Router = Router();

router.use(authMiddleware);

router.post("/threads", validate(createThreadSchema), createOrGetThread);
router.get("/threads", getMyThreads);
router.get("/threads/:threadId/messages", getMessages);
router.post("/threads/:threadId/messages", validate(sendMessageSchema), sendMessage);
router.patch("/threads/:threadId/close", closeThread);

export default router;
