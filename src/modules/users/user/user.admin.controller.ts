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

// GET /admin/users?status=blocked — list all customers, optionally filtered by status.
export const listCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query.status as UserStatus | undefined;
    const users = status
      ? await userRepository.findByStatus(status)
      : await userRepository.find();

    const safe = users.map(({ password, otp, otpExpiry, ...u }) => ({
      ...u,
      status: u.status ?? "active",
    }));
    sendResponse(res, HTTP_STATUS.OK, "Customers retrieved successfully", safe);
  }
);

// GET /admin/users/:id — fetch a single customer.
export const getCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await userRepository.findById(req.params.id);
    if (!user) throw ApiError.notFound("User not found");
    const { password, otp, otpExpiry, ...rest } = user as any;
    sendResponse(res, HTTP_STATUS.OK, "Customer retrieved successfully", {
      ...rest,
      status: rest.status ?? "active",
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
