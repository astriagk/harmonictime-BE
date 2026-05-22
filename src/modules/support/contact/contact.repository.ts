import { Filter } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { ContactMessage } from "./contact.types";

class ContactRepository extends BaseRepository<ContactMessage> {
  constructor() {
    super(COLLECTIONS.CONTACT_MESSAGES);
  }

  // Newest submissions first; optional filter (e.g. by read state).
  findMessages(filter: Filter<ContactMessage> = {}) {
    return this.collection.find(filter).sort({ createdAt: -1 }).toArray();
  }
}

export const contactRepository = new ContactRepository();
