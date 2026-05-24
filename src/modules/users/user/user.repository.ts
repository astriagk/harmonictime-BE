import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { User, UserStatus } from "./user.types";

class UserRepository extends BaseRepository<User> {
  constructor() {
    super(COLLECTIONS.USERS);
  }

  findByEmail(email: string) {
    return this.findOne({ email });
  }

  findByPhone(phone: string) {
    return this.findOne({ phone });
  }

  findByStatus(status: UserStatus) {
    return this.find({ status });
  }

  setStatus(userId: ObjectId | string, status: UserStatus) {
    return this.updateById(userId, { status });
  }
}

export const userRepository = new UserRepository();
