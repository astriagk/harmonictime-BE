import { ObjectId } from "mongodb";

// `archived` is the soft-delete state: the document stays so an admin can see
// it was removed rather than losing the record outright.
export type YoutubeVideoStatus = "draft" | "published" | "archived";

// One block in the home page "videos" grid.
export interface YoutubeVideo {
  _id?: ObjectId;
  Title: string;
  YoutubeUrl: string; // original URL as entered by the admin
  VideoId: string; // derived from YoutubeUrl — used to embed and to build the default thumbnail
  Thumbnail: string; // defaults to the YouTube-hosted thumbnail when not supplied
  Author: string; // display name only
  Order: number; // display order on the grid, ascending; ties break by newest first
  Status: YoutubeVideoStatus;
  PublishedAt: Date;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface YoutubeVideoListResult {
  items: YoutubeVideo[];
  total: number;
  page: number;
  limit: number;
}
