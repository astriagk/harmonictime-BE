import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { roleRepository, userRoleRepository } from "./role.repository";

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const { RoleID, RoleName } = req.body;
  const existing = await roleRepository.findOne({
    $or: [{ RoleID }, { RoleName }],
  } as any);
  if (existing)
    throw ApiError.conflict("A role with the same RoleID or RoleName already exists");

  const result = await roleRepository.insertOne({ RoleID, RoleName });
  sendResponse(res, HTTP_STATUS.CREATED, "Role created successfully", result);
});

export const getRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleRepository.find();
  sendResponse(res, HTTP_STATUS.OK, "", roles);
});

export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleRepository.findByRoleId(parseInt(req.params.roleID, 10));
  if (!role) throw ApiError.notFound("Role not found");
  sendResponse(res, HTTP_STATUS.OK, "", role);
});

export const createUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { UserRoleID, UserID, RoleID } = req.body;
  const userObjectId = new ObjectId(UserID);

  const existing = await userRoleRepository.findOne({
    UserID: userObjectId,
    RoleID,
  });
  if (existing)
    throw ApiError.conflict("A UserRole with the same UserID and RoleID already exists");

  const result = await userRoleRepository.insertOne({
    UserRoleID,
    UserID: userObjectId,
    RoleID,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "UserRole created successfully", result);
});

export const getUserRoles = asyncHandler(async (req: Request, res: Response) => {
  const roles = await userRoleRepository.findByUser(req.params.userId);
  sendResponse(res, HTTP_STATUS.OK, "UserRoles", roles);
});
