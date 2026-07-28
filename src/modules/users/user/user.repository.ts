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

  // Case-insensitive lookup. Emails are stored as the user typed them, so a
  // local signup as "Foo@x.com" and a Google identity for "foo@x.com" are the
  // same person and must link. Only the Google path needs this — plain login
  // keeps the exact match so existing accounts behave exactly as before.
  findByEmailInsensitive(email: string) {
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.findOne({ email: { $regex: `^${escaped}$`, $options: "i" } });
  }

  findByGoogleId(googleId: string) {
    return this.findOne({ googleId });
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
