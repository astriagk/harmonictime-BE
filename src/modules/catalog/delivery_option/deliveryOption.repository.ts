import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { DeliveryOption } from "./deliveryOption.types";

class DeliveryOptionRepository extends BaseRepository<DeliveryOption> {
  constructor() {
    super(COLLECTIONS.DELIVERY_OPTIONS);
  }

  findByName(DeliveryOptionName: string) {
    return this.findOne({ DeliveryOptionName });
  }
}

export const deliveryOptionRepository = new DeliveryOptionRepository();
