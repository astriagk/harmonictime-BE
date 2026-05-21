import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { ProductImage } from "./product_image.types";

class ProductImageRepository extends BaseRepository<ProductImage> {
  constructor() {
    super(COLLECTIONS.PRODUCT_IMAGES);
  }

  findByProductId(productId: string | ObjectId) {
    return this.find({ ProductID: this.toObjectId(productId) });
  }
}

export const productImageRepository = new ProductImageRepository();
