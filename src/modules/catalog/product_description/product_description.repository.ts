import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { ProductDescription } from "./product_description.types";

class ProductDescriptionRepository extends BaseRepository<ProductDescription> {
  constructor() {
    super(COLLECTIONS.PRODUCT_DESCRIPTION);
  }

  findByProductId(productId: string | ObjectId) {
    return this.findOne({ ProductID: this.toObjectId(productId) });
  }

  updateByProductId(productId: string | ObjectId, update: Partial<ProductDescription>) {
    return this.updateOne(
      { ProductID: this.toObjectId(productId) },
      { $set: update }
    );
  }

  deleteByProductId(productId: string | ObjectId) {
    return this.deleteOne({ ProductID: this.toObjectId(productId) });
  }
}

export const productDescriptionRepository = new ProductDescriptionRepository();
