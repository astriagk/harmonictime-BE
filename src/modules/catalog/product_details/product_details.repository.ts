import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { ProductDetails } from "./product_details.types";

class ProductDetailsRepository extends BaseRepository<ProductDetails> {
  constructor() {
    super(COLLECTIONS.PRODUCT_DETAILS);
  }

  findByProductId(productId: string | ObjectId) {
    return this.findOne({ ProductID: this.toObjectId(productId) });
  }

  updateByProductId(productId: string | ObjectId, update: Partial<ProductDetails>) {
    return this.updateOne({ ProductID: this.toObjectId(productId) }, { $set: update });
  }

  deleteByProductId(productId: string | ObjectId) {
    return this.deleteOne({ ProductID: this.toObjectId(productId) });
  }
}

export const productDetailsRepository = new ProductDetailsRepository();
