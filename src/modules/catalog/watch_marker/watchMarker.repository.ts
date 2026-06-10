import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { WatchMarker } from "./watchMarker.types";

class WatchMarkerRepository extends BaseRepository<WatchMarker> {
  constructor() {
    super(COLLECTIONS.WATCH_MARKERS);
  }

  findByName(WatchMarkerName: string) {
    return this.findOne({ WatchMarkerName });
  }

  findAll() {
    return this.find({}, { WatchMarkerName: 1 });
  }
}

export const watchMarkerRepository = new WatchMarkerRepository();
