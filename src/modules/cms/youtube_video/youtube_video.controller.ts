import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import {
  youtubeVideoRepository,
  extractYoutubeId,
  defaultThumbnail,
} from "./youtube_video.repository";
import { YoutubeVideo, YoutubeVideoStatus } from "./youtube_video.types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

const parsePaging = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const rawLimit = Number(req.query.limit) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit };
};

const objectIdParam = (id: string): ObjectId => {
  if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid video id");
  return new ObjectId(id);
};

const resolveVideoId = (url: string): string => {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw ApiError.badRequest("YoutubeUrl is not a recognised YouTube link");
  return videoId;
};

// GET /api/youtube-videos — published blocks for the home page grid.
export const listYoutubeVideos = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaging(req);
  const result = await youtubeVideoRepository.paginate(
    youtubeVideoRepository.publishedFilter(),
    page,
    limit
  );
  sendResponse(res, HTTP_STATUS.OK, "Videos retrieved successfully", result);
});

// GET /api/youtube-videos/admin/list — every status, for the admin grid manager.
// Registered before /:id so "admin" is never read as an id.
export const adminListYoutubeVideos = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaging(req);
  const filter: Filter<YoutubeVideo> = {};

  const status = req.query.Status;
  if (typeof status === "string" && status) {
    const allowed: YoutubeVideoStatus[] = ["draft", "published", "archived"];
    if (!allowed.includes(status as YoutubeVideoStatus))
      throw ApiError.badRequest("Status must be draft, published, or archived");
    filter.Status = status as YoutubeVideoStatus;
  }

  const result = await youtubeVideoRepository.paginate(filter, page, limit);
  sendResponse(res, HTTP_STATUS.OK, "Videos retrieved successfully", result);
});

// POST /api/youtube-videos — admin only.
export const createYoutubeVideo = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const now = new Date();
  const VideoId = resolveVideoId(body.YoutubeUrl);

  const doc: YoutubeVideo = {
    _id: new ObjectId(),
    Title: body.Title,
    YoutubeUrl: body.YoutubeUrl,
    VideoId,
    Thumbnail: body.Thumbnail || defaultThumbnail(VideoId),
    Author: body.Author,
    Order: body.Order ?? (await youtubeVideoRepository.nextOrder()),
    Status: body.Status ?? "draft",
    PublishedAt: new Date(body.PublishedAt),
    CreatedAt: now,
    UpdatedAt: now,
  };

  await youtubeVideoRepository.insertOne(doc);
  sendResponse(res, HTTP_STATUS.CREATED, "Video created successfully", doc);
});

// PUT /api/youtube-videos/:id — admin only. Every field optional.
export const updateYoutubeVideo = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req.params.id);
  const existing = await youtubeVideoRepository.findById(id);
  if (!existing) throw ApiError.notFound("Video not found");

  const body = req.body;
  const update: Partial<YoutubeVideo> = { UpdatedAt: new Date() };

  if (body.Title !== undefined) update.Title = body.Title;
  // Author and PublishedAt are required by the schema on every update, not
  // merged in conditionally like the rest of these fields.
  update.Author = body.Author;
  update.PublishedAt = new Date(body.PublishedAt);
  if (body.Order !== undefined) update.Order = body.Order;
  if (body.Status !== undefined) update.Status = body.Status;

  if (body.YoutubeUrl !== undefined) {
    update.VideoId = resolveVideoId(body.YoutubeUrl);
    update.YoutubeUrl = body.YoutubeUrl;
  }

  if (body.Thumbnail !== undefined) {
    // Explicit empty string falls back to the default for whichever video id
    // now applies, so clearing the field never leaves a blank thumbnail.
    update.Thumbnail = body.Thumbnail || defaultThumbnail(update.VideoId ?? existing.VideoId);
  } else if (update.VideoId !== undefined) {
    // A new URL with no explicit thumbnail swaps in that video's own default,
    // so switching videos doesn't leave the old video's thumbnail behind.
    update.Thumbnail = defaultThumbnail(update.VideoId);
  }

  await youtubeVideoRepository.updateById(id, update);
  const updated = await youtubeVideoRepository.findById(id);
  sendResponse(res, HTTP_STATUS.OK, "Video updated successfully", updated);
});

// DELETE /api/youtube-videos/:id — soft delete. `?hard=true` removes the document.
export const deleteYoutubeVideo = asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdParam(req.params.id);

  if (req.query.hard === "true") {
    const result = await youtubeVideoRepository.deleteById(id);
    if (result.deletedCount === 0) throw ApiError.notFound("Video not found");
    sendResponse(res, HTTP_STATUS.OK, "Video permanently deleted");
    return;
  }

  const result = await youtubeVideoRepository.updateById(id, {
    Status: "archived",
    UpdatedAt: new Date(),
  } as Partial<YoutubeVideo>);
  if (result.matchedCount === 0) throw ApiError.notFound("Video not found");
  sendResponse(res, HTTP_STATUS.OK, "Video archived successfully");
});
