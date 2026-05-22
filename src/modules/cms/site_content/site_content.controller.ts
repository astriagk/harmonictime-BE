import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { siteContentRepository } from "./site_content.repository";
import { SiteContent } from "./site_content.types";

export const createSiteContent = asyncHandler(
  async (req: Request, res: Response) => {
    const { type, data, order, isActive } = req.body;
    const now = new Date();
    const doc: SiteContent = {
      _id: new ObjectId(),
      type,
      data,
      order,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await siteContentRepository.insertOne(doc);
    sendResponse(res, HTTP_STATUS.CREATED, "Content created successfully", doc);
  }
);

// List content. No `type` query -> every type. `?type=` filters to one type,
// `?isActive=true|false` filters by active flag, `?grouped=true` returns a map
// keyed by type instead of a flat array. Always sorted by `order` ascending.
export const getSiteContent = asyncHandler(
  async (req: Request, res: Response) => {
    const { type, isActive, grouped } = req.query;

    const filter: Filter<SiteContent> = {};
    if (typeof type === "string" && type) filter.type = type;
    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    const items = await siteContentRepository.findContent(filter);

    if (grouped === "true") {
      const map: Record<string, SiteContent[]> = {};
      for (const item of items) {
        (map[item.type] ||= []).push(item);
      }
      sendResponse(res, HTTP_STATUS.OK, "", map);
      return;
    }

    sendResponse(res, HTTP_STATUS.OK, "", items);
  }
);

export const getSiteContentById = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await siteContentRepository.findById(req.params.id);
    if (!item) throw ApiError.notFound("Content not found");
    sendResponse(res, HTTP_STATUS.OK, "", item);
  }
);

export const updateSiteContent = asyncHandler(
  async (req: Request, res: Response) => {
    const update = { ...req.body, updatedAt: new Date() };
    const result = await siteContentRepository.updateById(req.params.id, update);
    if (result.matchedCount === 0) throw ApiError.notFound("Content not found");
    sendResponse(res, HTTP_STATUS.OK, "Content updated successfully");
  }
);

export const deleteSiteContent = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await siteContentRepository.deleteById(req.params.id);
    if (result.deletedCount === 0) throw ApiError.notFound("Content not found");
    sendResponse(res, HTTP_STATUS.OK, "Content deleted successfully");
  }
);
