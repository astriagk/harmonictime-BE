import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productRepository } from "./product.repository";
import { Product, ProductApprovalStatus } from "./product.types";

const adminObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

// GET /admin/products?status=Pending|Approved|Rejected
// Lists all products, optionally filtered by approval status.
export const adminListProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.query;
    const match: Filter<Product> = {};

    if (status) {
      const allowed: ProductApprovalStatus[] = ["Pending", "Approved", "Rejected"];
      if (!allowed.includes(status as ProductApprovalStatus))
        throw ApiError.badRequest("status must be Pending, Approved, or Rejected");
      (match as any).ApprovalStatus = status;
    } else {
      // Default: show everything so admin sees the full queue.
      // Use ?status=Pending to see only items awaiting review.
    }

    const products = await productRepository.getEnrichedWithStatus(match);
    sendResponse(res, HTTP_STATUS.OK, "Products retrieved successfully", products);
  }
);

// PUT /admin/products/:productID/approve
export const adminApproveProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = adminObjectId(req);
    const { productID } = req.params;
    if (!ObjectId.isValid(productID)) throw ApiError.badRequest("Invalid productID");

    const product = await productRepository.findById(productID);
    if (!product) throw ApiError.notFound("Product not found");

    await productRepository.updateById(productID, {
      ApprovalStatus: "Approved",
      IsAvailable: true,
      ApprovalNote: undefined,
      ApprovedBy: adminId,
      ApprovedAt: new Date(),
    } as Partial<Product>);

    sendResponse(res, HTTP_STATUS.OK, "Product approved — it is now visible to buyers");
  }
);

// PUT /admin/products/:productID/reject
// Body: { note: string } — reason surfaced to the seller.
export const adminRejectProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = adminObjectId(req);
    const { productID } = req.params;
    if (!ObjectId.isValid(productID)) throw ApiError.badRequest("Invalid productID");

    const { note } = req.body;
    if (!note || typeof note !== "string" || !note.trim())
      throw ApiError.badRequest("A rejection note is required so the seller knows what to fix");

    const product = await productRepository.findById(productID);
    if (!product) throw ApiError.notFound("Product not found");

    await productRepository.updateById(productID, {
      ApprovalStatus: "Rejected",
      ApprovalNote: note.trim(),
      ApprovedBy: adminId,
      ApprovedAt: new Date(),
    } as Partial<Product>);

    sendResponse(res, HTTP_STATUS.OK, "Product rejected — seller will see your note");
  }
);
