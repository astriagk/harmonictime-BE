import { Request, Response, NextFunction } from "express";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { userRepository } from "../../modules/users/user/user.repository";

// Guards seller write routes. Must run after authMiddleware (needs req.user).
// Passes only when the seller's admin verification status is "Approved".
// blocked/suspended accounts are already rejected by authMiddleware before this runs.
export const requireApprovedSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Unauthorized");
    return;
  }

  try {
    const user = await userRepository.findById(userId);
    if (!user) {
      sendResponse(res, HTTP_STATUS.UNAUTHORIZED, "Unauthorized");
      return;
    }

    if (user.sellerVerificationStatus !== "Approved") {
      sendResponse(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Your seller account is not yet approved. Please wait for admin verification.",
        { sellerVerificationStatus: user.sellerVerificationStatus ?? "Unverified" }
      );
      return;
    }

    next();
  } catch {
    sendResponse(res, HTTP_STATUS.FORBIDDEN, "Seller verification check failed");
  }
};

export default requireApprovedSeller;
