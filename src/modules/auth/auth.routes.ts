import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.middleware";
import { authMiddleware } from "../../shared/middlewares/auth.middleware";
import {
  register,
  login,
  verifyEmail,
  verifyPhone,
  resetPassword,
  refreshToken,
  verifyToken,
  confirmEmail,
  resendVerification,
  updateUnverifiedEmail,
  sendMobileOTP,
  verifyMobileOTP,
} from "./auth.controller";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
  confirmEmailSchema,
  resendVerificationSchema,
  updateUnverifiedEmailSchema,
  sendMobileOTPSchema,
  verifyMobileOTPSchema,
} from "./auth.validation";

const router: Router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/verify-phone", validate(verifyPhoneSchema), verifyPhone);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/verify-token", validate(verifyTokenSchema), verifyToken);
router.post("/confirm-email", validate(confirmEmailSchema), confirmEmail);
router.post("/resend-verification", validate(resendVerificationSchema), resendVerification);
router.post("/update-unverified-email", validate(updateUnverifiedEmailSchema), updateUnverifiedEmail);
router.post("/send-mobile-otp", authMiddleware, validate(sendMobileOTPSchema), sendMobileOTP);
router.post("/verify-mobile-otp", authMiddleware, validate(verifyMobileOTPSchema), verifyMobileOTP);

export default router;
