import { Filter } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { WatchCollection } from "./collection.types";

class CollectionRepository extends BaseRepository<WatchCollection> {
  constructor() {
    super(COLLECTIONS.COLLECTIONS);
  }

  findByName(CollectionName: string) {
    return this.findOne({ CollectionName });
  }

  list(filter: Filter<WatchCollection> = {}) {
    return this.find(filter, { CollectionName: 1 });
  }
}

export const collectionRepository = new CollectionRepository();
