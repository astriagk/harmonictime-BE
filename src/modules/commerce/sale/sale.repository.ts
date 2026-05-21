import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Sale } from "./sale.types";

class SaleRepository extends BaseRepository<Sale> {
  constructor() {
    super(COLLECTIONS.SALES);
  }

  findByBuyer(buyerId: string | ObjectId) {
    return this.find({ BuyerID: this.toObjectId(buyerId) });
  }
}

export const saleRepository = new SaleRepository();
