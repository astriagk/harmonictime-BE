import { Filter, Sort } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { YoutubeVideo, YoutubeVideoListResult } from "./youtube_video.types";

const NEWEST_FIRST: Sort = { Order: 1, CreatedAt: -1, _id: -1 };

// Accepts watch/short/embed/share URLs and bare 11-char ids.
const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{11})/,
];

export const extractYoutubeId = (url: string): string | null => {
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const defaultThumbnail = (videoId: string): string =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

class YoutubeVideoRepository extends BaseRepository<YoutubeVideo> {
  constructor() {
    super(COLLECTIONS.YOUTUBE_VIDEOS);
  }

  publishedFilter(): Filter<YoutubeVideo> {
    return { Status: "published" } as Filter<YoutubeVideo>;
  }

  async paginate(
    filter: Filter<YoutubeVideo>,
    page: number,
    limit: number
  ): Promise<YoutubeVideoListResult> {
    const [items, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort(NEWEST_FIRST)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  // New blocks default to the back of the queue: one past the current max Order.
  async nextOrder(): Promise<number> {
    const [last] = await this.collection
      .find({})
      .sort({ Order: -1 })
      .limit(1)
      .toArray();
    return last ? last.Order + 1 : 1;
  }
}

export const youtubeVideoRepository = new YoutubeVideoRepository();
