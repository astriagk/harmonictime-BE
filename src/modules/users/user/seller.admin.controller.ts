import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { userRepository } from "./user.repository";
import { gstRepository } from "../gst/gst.repository";
import { bankAccountRepository } from "../../wallet/bank_account/bank_account.repository";
import { productRepository } from "../../catalog/product/product.repository";
import { SellerVerificationStatus } from "./user.types";

const adminObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

// GET /admin/sellers?status=Unverified|Pending|Approved|Rejected
// Lists all users who have at least one product listing (i.e. are sellers).
// Optionally filter by their verification status.
export const adminListSellers = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.query;

    const allowed: SellerVerificationStatus[] = [
      "Unverified",
      "Pending",
      "Approved",
      "Rejected",
    ];
    if (status && !allowed.includes(status as SellerVerificationStatus))
      throw ApiError.badRequest(
        "status must be one of: Unverified, Pending, Approved, Rejected"
      );

    // Find distinct seller IDs from the Products collection.
    const sellerIdDocs = await productRepository.aggregate<{ _id: ObjectId }>([
      { $group: { _id: "$UserID" } },
    ]);
    const sellerIds = sellerIdDocs.map((d) => d._id);

    if (sellerIds.length === 0) {
      return sendResponse(res, HTTP_STATUS.OK, "Sellers retrieved successfully", []);
    }

    const filter: any = { _id: { $in: sellerIds } };
    if (status) {
      // "Unverified" sellers have no sellerVerificationStatus set yet.
      if (status === "Unverified") {
        filter.$or = [
          { sellerVerificationStatus: { $exists: false } },
          { sellerVerificationStatus: "Unverified" },
        ];
      } else {
        filter.sellerVerificationStatus = status;
      }
    }

    const users = await userRepository.find(filter);
    const sellers = users.map(({ password, otp, otpExpiry, refreshTokenHash, ...safe }: any) => safe);
    sendResponse(res, HTTP_STATUS.OK, "Sellers retrieved successfully", sellers);
  }
);

// GET /admin/sellers/:sellerID
// Full profile: user info + GST details + bank accounts + product count.
export const adminGetSellerProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { sellerID } = req.params;
    if (!ObjectId.isValid(sellerID)) throw ApiError.badRequest("Invalid sellerID");

    const user = await userRepository.findById(sellerID);
    if (!user) throw ApiError.notFound("Seller not found");

    const sellerObjId = new ObjectId(sellerID);

    const [gst, bankAccounts, productStats] = await Promise.all([
      gstRepository.findBySeller(sellerObjId),
      bankAccountRepository.findBySeller(sellerObjId),
      productRepository.aggregate<{ total: number; approved: number; pending: number; rejected: number }>([
        { $match: { UserID: sellerObjId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$ApprovalStatus", "Approved"] }, 1, 0],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$ApprovalStatus", "Pending"] },
                      { $not: { $ifNull: ["$ApprovalStatus", false] } },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$ApprovalStatus", "Rejected"] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const { password, otp, otpExpiry, refreshTokenHash, ...safeUser } = user as any;

    sendResponse(res, HTTP_STATUS.OK, "Seller profile retrieved successfully", {
      seller: safeUser,
      gst: gst ?? null,
      bankAccounts,
      products: productStats[0] ?? { total: 0, approved: 0, pending: 0, rejected: 0 },
    });
  }
);

// PUT /admin/sellers/:sellerID/approve
export const adminApproveSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = adminObjectId(req);
    const { sellerID } = req.params;
    if (!ObjectId.isValid(sellerID)) throw ApiError.badRequest("Invalid sellerID");

    const user = await userRepository.findById(sellerID);
    if (!user) throw ApiError.notFound("Seller not found");

    await userRepository.updateById(sellerID, {
      sellerVerificationStatus: "Approved",
      sellerVerificationNote: undefined,
      sellerVerifiedBy: adminId,
      sellerVerifiedAt: new Date(),
    } as any);

    sendResponse(res, HTTP_STATUS.OK, "Seller approved successfully");
  }
);

// PUT /admin/sellers/:sellerID/reject
// Body: { note: string }
export const adminRejectSeller = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = adminObjectId(req);
    const { sellerID } = req.params;
    if (!ObjectId.isValid(sellerID)) throw ApiError.badRequest("Invalid sellerID");

    const { note } = req.body;
    if (!note || typeof note !== "string" || !note.trim())
      throw ApiError.badRequest("A rejection note is required");

    const user = await userRepository.findById(sellerID);
    if (!user) throw ApiError.notFound("Seller not found");

    await userRepository.updateById(sellerID, {
      sellerVerificationStatus: "Rejected",
      sellerVerificationNote: note.trim(),
      sellerVerifiedBy: adminId,
      sellerVerifiedAt: new Date(),
    } as any);

    sendResponse(res, HTTP_STATUS.OK, "Seller rejected — note saved");
  }
);

// PUT /admin/sellers/:sellerID/request-info
// Keeps status as Pending but saves a note telling the seller what is missing.
// Body: { note: string }
export const adminRequestSellerInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = adminObjectId(req);
    const { sellerID } = req.params;
    if (!ObjectId.isValid(sellerID)) throw ApiError.badRequest("Invalid sellerID");

    const { note } = req.body;
    if (!note || typeof note !== "string" || !note.trim())
      throw ApiError.badRequest("A note describing the missing information is required");

    const user = await userRepository.findById(sellerID);
    if (!user) throw ApiError.notFound("Seller not found");

    await userRepository.updateById(sellerID, {
      sellerVerificationStatus: "Pending",
      sellerVerificationNote: note.trim(),
      sellerVerifiedBy: adminId,
      sellerVerifiedAt: new Date(),
    } as any);

    sendResponse(res, HTTP_STATUS.OK, "Information request saved — seller will see your note");
  }
);
