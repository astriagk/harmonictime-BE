import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { bankAccountRepository } from "./bank_account.repository";

const sellerObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

// Load a bank account and assert it belongs to the authenticated seller.
const findOwned = async (req: Request, sellerId: ObjectId) => {
  const { accountID } = req.params;
  if (!ObjectId.isValid(accountID))
    throw ApiError.badRequest("Invalid account id");
  const account = await bankAccountRepository.findById(accountID);
  if (!account || account.SellerID.toString() !== sellerId.toString())
    throw ApiError.notFound("Bank account not found");
  return account;
};

export const createBankAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = sellerObjectId(req);
    const { AccountHolderName, AccountNumber, IFSC, BankName, IsDefault } = req.body;

    // First account is default automatically; otherwise honour the flag.
    const existing = await bankAccountRepository.findBySeller(sellerId);
    const makeDefault = IsDefault ?? existing.length === 0;
    if (makeDefault) await bankAccountRepository.clearDefault(sellerId);

    const result = await bankAccountRepository.insertOne({
      SellerID: sellerId,
      AccountHolderName,
      AccountNumber,
      IFSC,
      BankName,
      IsDefault: makeDefault,
      CreatedAt: new Date(),
    });
    sendResponse(res, HTTP_STATUS.CREATED, "Bank account added successfully", result);
  }
);

export const getBankAccounts = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = sellerObjectId(req);
    const accounts = await bankAccountRepository.findBySeller(sellerId);
    sendResponse(res, HTTP_STATUS.OK, "Bank accounts retrieved successfully", accounts);
  }
);

export const updateBankAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = sellerObjectId(req);
    const account = await findOwned(req, sellerId);

    if (req.body.IsDefault === true)
      await bankAccountRepository.clearDefault(sellerId, account._id);

    await bankAccountRepository.updateById(account._id!, req.body);
    sendResponse(res, HTTP_STATUS.OK, "Bank account updated successfully");
  }
);

export const deleteBankAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = sellerObjectId(req);
    const account = await findOwned(req, sellerId);
    await bankAccountRepository.deleteById(account._id!);
    sendResponse(res, HTTP_STATUS.OK, "Bank account deleted successfully");
  }
);
