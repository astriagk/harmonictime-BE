import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { DialColor } from "./dialColor.types";

class DialColorRepository extends BaseRepository<DialColor> {
  constructor() {
    super(COLLECTIONS.DIAL_COLORS);
  }

  findByName(DialColorName: string) {
    return this.findOne({ DialColorName });
  }

  findAll() {
    return this.find({}, { DialColorName: 1 });
  }
}

export const dialColorRepository = new DialColorRepository();
