import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { withdrawalRepository } from "./withdrawal.repository";
import { earningRepository } from "../earning/earning.repository";
import { bankAccountRepository } from "../bank_account/bank_account.repository";
import { WithdrawalStatus } from "./withdrawal.types";

const authedObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

// ---------------------------------------------------------------- seller side

// POST /withdrawals — request a payout of all currently-available earnings.
export const requestWithdrawal = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = authedObjectId(req);
    const { BankAccountID } = req.body;

    if (!ObjectId.isValid(BankAccountID))
      throw ApiError.badRequest("Invalid BankAccountID");
    const account = await bankAccountRepository.findById(BankAccountID);
    if (!account || account.SellerID.toString() !== sellerId.toString())
      throw ApiError.badRequest("Bank account not found");

    // Promote any newly-eligible earnings, then take everything available.
    await earningRepository.refreshEligibility(sellerId);
    const available = await earningRepository.findAvailable(sellerId);
    if (available.length === 0)
      throw ApiError.badRequest("No funds available to withdraw");

    const amount = available.reduce((sum, e) => sum + e.NetAmount, 0);
    const earningIds = available.map((e) => e._id!);

    const result = await withdrawalRepository.insertOne({
      SellerID: sellerId,
      BankAccountID: account._id!,
      BankSnapshot: {
        AccountHolderName: account.AccountHolderName,
        AccountNumber: account.AccountNumber,
        IFSC: account.IFSC,
        BankName: account.BankName,
      },
      Amount: amount,
      EarningIDs: earningIds,
      Status: "Pending",
      RequestedAt: new Date(),
    });

    await earningRepository.lockForWithdrawal(earningIds, result.insertedId);

    sendResponse(res, HTTP_STATUS.CREATED, "Withdrawal requested successfully", {
      _id: result.insertedId,
      Amount: amount,
      ItemCount: earningIds.length,
      Status: "Pending",
    });
  }
);

// GET /withdrawals?status=Paid — the seller's own payout history.
export const getWithdrawals = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = authedObjectId(req);
    const status = req.query.status as WithdrawalStatus | undefined;
    const withdrawals = await withdrawalRepository.findBySeller(sellerId, status);
    sendResponse(res, HTTP_STATUS.OK, "Withdrawals retrieved successfully", withdrawals);
  }
);

// PUT /withdrawals/:withdrawalID/cancel — only while still Pending.
export const cancelWithdrawal = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = authedObjectId(req);
    const { withdrawalID } = req.params;
    if (!ObjectId.isValid(withdrawalID))
      throw ApiError.badRequest("Invalid withdrawal id");

    const withdrawal = await withdrawalRepository.findById(withdrawalID);
    if (!withdrawal || withdrawal.SellerID.toString() !== sellerId.toString())
      throw ApiError.notFound("Withdrawal not found");
    if (withdrawal.Status !== "Pending")
      throw ApiError.badRequest("Only pending withdrawals can be cancelled");

    // Release the locked earnings back to Available, then drop the request.
    await earningRepository.release(withdrawal._id!);
    await withdrawalRepository.deleteById(withdrawal._id!);
    sendResponse(res, HTTP_STATUS.OK, "Withdrawal cancelled successfully");
  }
);

// ----------------------------------------------------------------- admin side

// GET /admin/withdrawals?status=Pending — payout queue across all sellers.
export const listWithdrawals = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query.status as WithdrawalStatus | undefined;
    const withdrawals = await withdrawalRepository.findByStatus(status);
    sendResponse(res, HTTP_STATUS.OK, "Withdrawals retrieved successfully", withdrawals);
  }
);

// PUT /admin/withdrawals/:withdrawalID/pay — money deposited externally; mark
// Paid and settle the covered earnings.
export const payWithdrawal = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = authedObjectId(req);
    const { withdrawalID } = req.params;
    if (!ObjectId.isValid(withdrawalID))
      throw ApiError.badRequest("Invalid withdrawal id");

    const withdrawal = await withdrawalRepository.findById(withdrawalID);
    if (!withdrawal) throw ApiError.notFound("Withdrawal not found");
    if (withdrawal.Status !== "Pending" && withdrawal.Status !== "Approved")
      throw ApiError.badRequest(`Cannot pay a ${withdrawal.Status} withdrawal`);

    await withdrawalRepository.updateById(withdrawal._id!, {
      Status: "Paid",
      Reference: req.body.Reference,
      Notes: req.body.Notes,
      ProcessedAt: new Date(),
      ProcessedBy: adminId,
    });
    await earningRepository.settle(withdrawal._id!);

    sendResponse(res, HTTP_STATUS.OK, "Withdrawal marked as paid");
  }
);

// PUT /admin/withdrawals/:withdrawalID/reject — release earnings back to Available.
export const rejectWithdrawal = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = authedObjectId(req);
    const { withdrawalID } = req.params;
    if (!ObjectId.isValid(withdrawalID))
      throw ApiError.badRequest("Invalid withdrawal id");

    const withdrawal = await withdrawalRepository.findById(withdrawalID);
    if (!withdrawal) throw ApiError.notFound("Withdrawal not found");
    if (withdrawal.Status !== "Pending" && withdrawal.Status !== "Approved")
      throw ApiError.badRequest(`Cannot reject a ${withdrawal.Status} withdrawal`);

    await earningRepository.release(withdrawal._id!);
    await withdrawalRepository.updateById(withdrawal._id!, {
      Status: "Rejected",
      Notes: req.body.Notes,
      ProcessedAt: new Date(),
      ProcessedBy: adminId,
    });

    sendResponse(res, HTTP_STATUS.OK, "Withdrawal rejected");
  }
);
