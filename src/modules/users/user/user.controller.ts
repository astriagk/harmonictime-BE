import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { userRepository } from "./user.repository";
import { userRoleRepository } from "../role/role.repository";
import { addressRepository } from "../address/address.repository";

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "Users retrieved successfully", users);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userRepository.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  sendResponse(res, HTTP_STATUS.OK, "User retrieved successfully", user);
});

export const updateUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await userRepository.updateById(req.params.id, req.body);
    if (result.matchedCount === 0) throw ApiError.notFound("User not found");
    sendResponse(res, HTTP_STATUS.OK, "User updated successfully");
  },
);

export const deleteUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await userRepository.deleteById(req.params.id);
    if (result.deletedCount === 0) throw ApiError.notFound("User not found");
    sendResponse(res, HTTP_STATUS.OK, "User deleted successfully");
  },
);

export const getUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    const roles = await userRoleRepository.findByUser(userId);
    const addresses = await addressRepository.findByUser(userId);
    const { password, ...safeUser } = user as any;
    sendResponse(res, HTTP_STATUS.OK, "User profile retrieved successfully", {
      ...safeUser,
      roles: roles.map((r) => r.RoleID),
      addresses,
    });
  },
);
