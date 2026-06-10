import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Brand } from "./brand.types";

class BrandRepository extends BaseRepository<Brand> {
  constructor() {
    super(COLLECTIONS.BRANDS);
  }

  findByName(BrandName: string) {
    return this.findOne({ BrandName });
  }

  findByNames(names: string[]) {
    return this.find({ BrandName: { $in: names } });
  }

  findAll() {
    return this.find({}, { BrandName: 1 });
  }
}

export const brandRepository = new BrandRepository();
