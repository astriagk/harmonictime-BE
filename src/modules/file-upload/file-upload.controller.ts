import { Request, Response } from "express";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { deleteFile, uploadFile } from "../../shared/services/file-storage.service";

// Upload one or more images to S3 and return their hosted URLs.
// Contract is unchanged from the previous ImgBB implementation so the frontend
// keeps working: multipart field `images` (up to 10), body `userID`/`productID`,
// response `{ urls: [...] }`.
export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) throw ApiError.badRequest("No files uploaded");

  const { userID, productID } = req.body as Record<string, string>;
  const folder = [userID, productID].filter(Boolean).join("/") || "products";

  const urls = await Promise.all(files.map((file) => uploadFile(file, folder)));

  sendResponse(res, HTTP_STATUS.OK, "Images uploaded successfully", { urls });
});

// Delete a hosted image. `imageId` is the S3 object key or full URL (the same
// value the frontend received as a `url`). S3 deletes are idempotent.
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const { imageId } = req.params;
  if (!imageId) throw ApiError.badRequest("ImageID required");

  await deleteFile(decodeURIComponent(imageId));

  sendResponse(res, HTTP_STATUS.OK, "Image deleted successfully");
});
