import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { CaseMaterial } from "./caseMaterial.types";

class CaseMaterialRepository extends BaseRepository<CaseMaterial> {
  constructor() {
    super(COLLECTIONS.CASE_MATERIALS);
  }

  findByName(CaseMaterialName: string) {
    return this.findOne({ CaseMaterialName });
  }
}

export const caseMaterialRepository = new CaseMaterialRepository();
