import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { SellerGSTDetails } from "./gst.types";

class GSTRepository extends BaseRepository<SellerGSTDetails> {
  constructor() {
    super(COLLECTIONS.SELLER_GST_DETAILS);
  }

  findBySeller(userId: ObjectId) {
    return this.findOne({ UserID: userId });
  }

  findByGSTIN(gstin: string) {
    return this.findOne({ GSTIN: gstin });
  }
}

export const gstRepository = new GSTRepository();
