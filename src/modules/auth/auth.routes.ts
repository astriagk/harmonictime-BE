import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  register,
  login,
  verifyEmail,
  verifyPhone,
  resetPassword,
  refreshToken,
  verifyToken,
} from "./auth.controller";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
} from "./auth.validation";

const router: Router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/verify-phone", validate(verifyPhoneSchema), verifyPhone);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/verify-token", validate(verifyTokenSchema), verifyToken);

export default router;
