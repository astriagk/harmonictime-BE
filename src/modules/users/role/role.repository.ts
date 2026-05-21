import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Role, UserRole } from "./role.types";

class RoleRepository extends BaseRepository<Role> {
  constructor() {
    super(COLLECTIONS.ROLES);
  }
  findByRoleId(RoleID: number) {
    return this.findOne({ RoleID });
  }
}

class UserRoleRepository extends BaseRepository<UserRole> {
  constructor() {
    super(COLLECTIONS.USER_ROLES);
  }
  findByUser(UserID: string | ObjectId) {
    return this.find({ UserID: this.toObjectId(UserID) });
  }
}

export const roleRepository = new RoleRepository();
export const userRoleRepository = new UserRoleRepository();
