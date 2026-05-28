import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { earningRepository } from "./earning.repository";
import { EarningStatus } from "./earning.types";
import { userRepository } from "../../users/user/user.repository";
import { env } from "../../../shared/config/env";

// The authenticated seller's id, from the JWT — never trusted from params/body.
const sellerObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

// GET /wallet/product-eligibility — checks if an individual seller has crossed
// the GST threshold; frontend calls this before navigating to product creation.
export const checkProductEligibility = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = sellerObjectId(req);
  const user = await userRepository.findById(sellerId.toString());
  if (!user) throw ApiError.unauthorized("Invalid session");

  const [balances, totalGrossSales] = await Promise.all([
    earningRepository.getBalances(sellerId),
    earningRepository.getTotalGrossSales(sellerId),
  ]);

  if (user.accountType !== "individual") {
    return sendResponse(res, HTTP_STATUS.OK, "Eligible to create products", {
      canCreate: true,
      availableBalance: balances.availableBalance,
    });
  }

  const threshold = env.SELLER_GST_THRESHOLD;

  return sendResponse(res, HTTP_STATUS.OK, "Eligibility checked", {
    canCreate: totalGrossSales < threshold,
    totalGrossSales,
    threshold,
    availableBalance: balances.availableBalance,
  });
});

// GET /wallet — balance summary for the authenticated seller.
export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = sellerObjectId(req);
  await earningRepository.refreshEligibility(sellerId);
  const balances = await earningRepository.getBalances(sellerId);
  sendResponse(res, HTTP_STATUS.OK, "Wallet retrieved successfully", balances);
});

const ALLOWED_STATUSES: EarningStatus[] = [
  "Pending",
  "Available",
  "Requested",
  "Settled",
];

// GET /wallet/items?status=available|pending|requested|settled
// Itemized sold items; defaults to all. Capitalizes the query for matching.
export const getWalletItems = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = sellerObjectId(req);
  await earningRepository.refreshEligibility(sellerId);

  let status: EarningStatus | undefined;
  if (req.query.status) {
    const raw = String(req.query.status);
    const normalized = (raw.charAt(0).toUpperCase() +
      raw.slice(1).toLowerCase()) as EarningStatus;
    if (!ALLOWED_STATUSES.includes(normalized))
      throw ApiError.badRequest("Invalid status filter");
    status = normalized;
  }

  const items = await earningRepository.getItems(sellerId, status);
  sendResponse(res, HTTP_STATUS.OK, "Wallet items retrieved successfully", items);
});
