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

  // Every offer, active or not — for the admin list where disabled offers must
  // remain visible so they can be re-enabled.
  findAll() {
    return this.find({});
  }

  setActive(id: string, IsActive: boolean) {
    return this.updateById(id, { IsActive } as Partial<Offer>);
  }
}

export const offerRepository = new OfferRepository();
