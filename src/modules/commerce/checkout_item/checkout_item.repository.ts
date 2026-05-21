import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { CheckoutItem } from "./checkout_item.types";

class CheckoutItemRepository extends BaseRepository<CheckoutItem> {
  constructor() {
    super(COLLECTIONS.CHECKOUT_ITEMS);
  }

  findByCheckout(checkoutId: string | ObjectId) {
    return this.find({ CheckoutID: this.toObjectId(checkoutId) });
  }
}

export const checkoutItemRepository = new CheckoutItemRepository();
