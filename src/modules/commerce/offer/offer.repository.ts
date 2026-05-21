import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Offer } from "./offer.types";

class OfferRepository extends BaseRepository<Offer> {
  constructor() {
    super(COLLECTIONS.OFFERS);
  }

  findByName(OfferName: string) {
    return this.findOne({ OfferName });
  }

  findActive() {
    return this.find({ IsActive: true });
  }
}

export const offerRepository = new OfferRepository();
