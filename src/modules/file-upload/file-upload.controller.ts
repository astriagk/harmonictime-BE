import { Request, Response } from "express";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { deleteFile, uploadFile } from "../../shared/services/file-storage.service";

// Build a clean S3 key prefix from path segments. Strips surrounding slashes,
// drops empty segments, and removes characters that don't belong in a key, so
// uploads stay neatly grouped under a top-level folder (e.g.
// "products/<productID>" or "site-content/hero") instead of being dumped at the
// bucket root keyed only by id. A segment may itself be a breadcrumb path
// (e.g. "hero/banners") — inner slashes are preserved.
const buildFolder = (...segments: (string | undefined)[]): string =>
  segments
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) =>
      s
        .trim()
        .replace(/^\/+|\/+$/g, "")
        .replace(/[^a-zA-Z0-9/_-]/g, "-")
    )
    .filter(Boolean)
    .join("/");

// Upload one or more images to S3 and return their hosted URLs.
// Multipart field `images` (up to 10), body `userID`/`productID`, response
// `{ urls: [...] }`. Always grouped under "products/" so product media stays in
// one place: products/<userID>/<productID>/<file>.
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) throw ApiError.badRequest("No files uploaded");

  const { userID, productID } = req.body as Record<string, string>;
  const folder = buildFolder("products", userID, productID);

  const urls = await Promise.all(files.map((file) => uploadFile(file, folder)));

  sendResponse(res, HTTP_STATUS.OK, "Images uploaded successfully", { urls });
});

// Upload a single image to S3 and return its hosted URL. Used by the CMS flow:
// the admin uploads an image, then pastes the returned `url` into the content
// JSON. Multipart field `image`, optional body `folder` (a breadcrumb subpath).
// Always grouped under "site-content/" → site-content/<folder>/<file>.
export const uploadSingleImage = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest("No file uploaded");

    const folder = buildFolder("site-content", req.body.folder as string);
    const url = await uploadFile(file, folder);

    sendResponse(res, HTTP_STATUS.OK, "Image uploaded successfully", { url });
  }
);

// Delete a hosted image. `imageId` is the S3 object key or full URL (the same
// value the frontend received as a `url`). S3 deletes are idempotent.
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { imageId } = req.params;
  if (!imageId) throw ApiError.badRequest("ImageID required");

  await deleteFile(decodeURIComponent(imageId));

  sendResponse(res, HTTP_STATUS.OK, "Image deleted successfully");
});
