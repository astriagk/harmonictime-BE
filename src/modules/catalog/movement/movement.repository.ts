import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Movement } from "./movement.types";

class MovementRepository extends BaseRepository<Movement> {
  constructor() {
    super(COLLECTIONS.MOVEMENTS);
  }

  findByName(MovementName: string) {
    return this.findOne({ MovementName });
  }
}

export const movementRepository = new MovementRepository();
