import { Request, Response, NextFunction } from "express";
import { userRoleRepository } from "../../modules/users/role/role.repository";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { MESSAGES } from "../constants/messages";
import { RoleId } from "../constants/roles";

// Guards admin-only routes. MUST run after authMiddleware (needs req.user). Looks
// up the caller's UserRoles and rejects anyone without the admin role.
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.UNAUTHORIZED);
    return;
  }

  try {
    const roles = await userRoleRepository.findByUser(userId);
    if (!roles.some((r) => r.RoleID === RoleId.ADMIN)) {
      sendResponse(res, HTTP_STATUS.FORBIDDEN, "Admin access required");
      return;
    }
    next();
  } catch {
    sendResponse(res, HTTP_STATUS.FORBIDDEN, "Admin access required");
  }
};

export default requireAdmin;
