import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Recipient } from "./recipient.types";

class RecipientRepository extends BaseRepository<Recipient> {
  constructor() {
    super(COLLECTIONS.RECIPIENTS);
  }

  findByName(RecipientName: string) {
    return this.findOne({ RecipientName });
  }

  findAll() {
    return this.find({}, { RecipientName: 1 });
  }
}

export const recipientRepository = new RecipientRepository();
