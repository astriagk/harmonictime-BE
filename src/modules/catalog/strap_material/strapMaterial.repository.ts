import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { StrapMaterial } from "./strapMaterial.types";

class StrapMaterialRepository extends BaseRepository<StrapMaterial> {
  constructor() {
    super(COLLECTIONS.STRAP_MATERIALS);
  }

  findByName(StrapMaterialName: string) {
    return this.findOne({ StrapMaterialName });
  }

  findAll() {
    return this.find({}, { StrapMaterialName: 1 });
  }
}

export const strapMaterialRepository = new StrapMaterialRepository();
