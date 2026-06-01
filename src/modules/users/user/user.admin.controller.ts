import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { userRepository } from "./user.repository";
import { UserStatus } from "./user.types";
import { sendTemplateEmail } from "../../../shared/services/email.service";
import {
  accountBlockedEmail,
  accountSuspendedEmail,
  accountRestoredEmail,
  EmailTemplate,
} from "../../../shared/email-templates";
import { userRoleRepository, roleRepository } from "../role/role.repository";
import { gstRepository } from "../gst/gst.repository";
import { bankAccountRepository } from "../../wallet/bank_account/bank_account.repository";

const stripSensitive = ({ password, otp, otpExpiry, refreshTokenHash, emailVerificationToken, emailVerificationTokenExpiry, ...u }: any) => ({
  ...u,
  status: u.status ?? "active",
});

// Resolve RoleID integers to role name strings for a set of users in one batch.
// Returns a map of userId (string) → role names array.
const batchResolveRoles = async (userIds: ObjectId[]): Promise<Map<string, string[]>> => {
  const userRoleDocs = await userRoleRepository.find({ UserID: { $in: userIds } } as any);
  const roleIds = [...new Set(userRoleDocs.map((r) => r.RoleID))];
  const roleDocs = await roleRepository.find({ RoleID: { $in: roleIds } } as any);
  const roleMap = new Map(roleDocs.map((r) => [r.RoleID, r.RoleName]));

  const result = new Map<string, string[]>();
  for (const ur of userRoleDocs) {
    const key = ur.UserID.toString();
    const roleName = roleMap.get(ur.RoleID) ?? String(ur.RoleID);
    if (!result.has(key)) result.set(key, []);
    result.get(key)!.push(roleName);
  }
  return result;
};

// GET /admin/users?status=blocked — list all users with their roles.
export const listCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query.status as UserStatus | undefined;
    const users = status
      ? await userRepository.findByStatus(status)
      : await userRepository.find();

    const userIds = users.map((u) => u._id as ObjectId);
    const rolesMap = await batchResolveRoles(userIds);

    const safe = users.map((u) => ({
      ...stripSensitive(u),
      roles: rolesMap.get(u._id!.toString()) ?? [],
    }));

    sendResponse(res, HTTP_STATUS.OK, "Customers retrieved successfully", safe);
  }
);

// GET /admin/users/:id — full user profile: user info + roles + GST + bank accounts.
export const getCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid user id");

    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound("User not found");

    const userObjId = new ObjectId(id);

    const [userRoleDocs, gst, bankAccounts] = await Promise.all([
      userRoleRepository.findByUser(userObjId),
      gstRepository.findBySeller(userObjId),
      bankAccountRepository.findBySeller(userObjId),
    ]);

    const roleIds = userRoleDocs.map((r) => r.RoleID);
    const roleDocs = roleIds.length > 0
      ? await roleRepository.find({ RoleID: { $in: roleIds } } as any)
      : [];

    sendResponse(res, HTTP_STATUS.OK, "User retrieved successfully", {
      user: stripSensitive(user),
      roles: roleDocs.map((r) => ({ roleId: r.RoleID, roleName: r.RoleName })),
      gst: gst ?? null,
      bankAccounts,
    });
  }
);

const setStatus = (targetStatus: UserStatus, emailTemplateFn: () => EmailTemplate) =>
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid user id");

    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound("User not found");
    const currentStatus = user.status ?? "active";
    if (currentStatus === targetStatus)
      throw ApiError.badRequest(`User is already ${targetStatus}`);

    await userRepository.setStatus(id, targetStatus);

    // Fire-and-forget — email failure must not block the admin action.
    sendTemplateEmail(user.email, emailTemplateFn()).catch(() => {});

    sendResponse(res, HTTP_STATUS.OK, `User ${targetStatus} successfully`);
  });

// PUT /admin/users/:id/block
export const blockUser = setStatus("blocked", accountBlockedEmail);

// PUT /admin/users/:id/unblock
export const unblockUser = setStatus("active", accountRestoredEmail);

// PUT /admin/users/:id/suspend
export const suspendUser = setStatus("suspended", accountSuspendedEmail);
