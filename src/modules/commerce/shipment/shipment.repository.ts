import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Shipment } from "./shipment.types";

class ShipmentRepository extends BaseRepository<Shipment> {
  constructor() {
    super(COLLECTIONS.SHIPMENTS);
  }

  findByCheckout(checkoutId: string | ObjectId) {
    return this.find({ CheckoutID: this.toObjectId(checkoutId) });
  }

  findBySeller(sellerId: string | ObjectId) {
    return this.find({ SellerID: this.toObjectId(sellerId) });
  }
}

export const shipmentRepository = new ShipmentRepository();
