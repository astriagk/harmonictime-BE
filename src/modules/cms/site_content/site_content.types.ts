import { ObjectId } from "mongodb";

// A single, type-driven CMS content block. `type` groups records (e.g.
// "hero_slider", "category_banner", "video_area" — or any new type added later)
// and `data` holds the freeform JSON the frontend renders. The shape of `data`
// is intentionally NOT constrained so new block types need no backend change.
export interface SiteContent {
  _id?: ObjectId;
  type: string;
  data: Record<string, any> | any[];
  order?: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
