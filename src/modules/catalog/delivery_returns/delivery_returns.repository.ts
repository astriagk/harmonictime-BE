import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { DeliveryReturn } from "./delivery_returns.types";

class DeliveryReturnsRepository extends BaseRepository<DeliveryReturn> {
  constructor() {
    super(COLLECTIONS.DELIVERY_RETURNS);
  }

  findByProductId(productId: string | ObjectId) {
    return this.find({ ProductID: this.toObjectId(productId) });
  }

  updateByProductId(productId: string | ObjectId, update: Partial<DeliveryReturn>) {
    return this.updateOne({ ProductID: this.toObjectId(productId) }, { $set: update });
  }
}

export const deliveryReturnsRepository = new DeliveryReturnsRepository();
