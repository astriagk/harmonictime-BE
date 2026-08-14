import { Request, Response, NextFunction } from "express";
import { userRoleRepository } from "../../modules/users/role/role.repository";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { MESSAGES } from "../constants/messages";
import { RoleId } from "../constants/roles";

// Does this user hold the admin role? Exported for routes that must *behave*
// differently for an admin rather than reject non-admins outright — e.g. the
// blog detail endpoint, which serves drafts to an admin and 404s for everyone
// else. Never throws: an unknown user is simply not an admin.
export const isAdminUser = async (
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  try {
    const roles = await userRoleRepository.findByUser(userId);
    return roles.some((r) => r.RoleID === RoleId.ADMIN);
  } catch {
    return false;
  }
};

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

  if (!(await isAdminUser(userId))) {
    sendResponse(res, HTTP_STATUS.FORBIDDEN, "Admin access required");
    return;
  }
  next();
};

export default requireAdmin;
