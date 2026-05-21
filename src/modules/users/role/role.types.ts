import { ObjectId } from "mongodb";

export interface Role {
  _id?: ObjectId;
  RoleID: number;
  RoleName: string;
}

export interface UserRole {
  _id?: ObjectId;
  UserRoleID: number;
  UserID: ObjectId;
  RoleID: number;
}
