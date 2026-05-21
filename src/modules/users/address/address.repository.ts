import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Address } from "./address.types";

class AddressRepository extends BaseRepository<Address> {
  constructor() {
    super(COLLECTIONS.ADDRESS);
  }

  findByUser(UserID: string | ObjectId) {
    return this.find({ UserID: this.toObjectId(UserID) });
  }
}

export const addressRepository = new AddressRepository();
