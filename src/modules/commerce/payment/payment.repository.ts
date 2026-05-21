import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Payment } from "./payment.types";

class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super(COLLECTIONS.PAYMENTS);
  }

  findByRazorpayOrderId(RazorpayOrderID: string) {
    return this.findOne({ RazorpayOrderID });
  }

  findByCheckout(checkoutId: string | ObjectId) {
    return this.find({ CheckoutID: this.toObjectId(checkoutId) });
  }
}

export const paymentRepository = new PaymentRepository();
