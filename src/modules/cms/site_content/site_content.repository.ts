import { Filter } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { SiteContent } from "./site_content.types";

class SiteContentRepository extends BaseRepository<SiteContent> {
  constructor() {
    super(COLLECTIONS.SITE_CONTENT);
  }

  // List content, optionally filtered by type and/or active flag, sorted by
  // `order` ascending (records without an order sort first).
  findContent(filter: Filter<SiteContent> = {}) {
    return this.collection.find(filter).sort({ order: 1 }).toArray();
  }
}

export const siteContentRepository = new SiteContentRepository();
