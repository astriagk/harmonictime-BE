import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import axios from "axios";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { bankAccountRepository } from "./bank_account.repository";
import { env } from "../../../shared/config/env";

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
      IsVerified: false,
      VerificationStatus: "unverified",
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

// POST /bank-accounts/:accountID/verify
// Triggers a Razorpay penny-drop against the seller's saved bank account.
// On success the account is marked verified and the bank-confirmed name is stored.
// Liability shifts to the seller once they verify — we retain VerifiedName as proof.
export const verifyBankAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = sellerObjectId(req);
    const account = await findOwned(req, sellerId);

    if (account.IsVerified)
      return sendResponse(res, HTTP_STATUS.OK, "Bank account is already verified", {
        IsVerified: true,
        VerificationStatus: account.VerificationStatus,
        VerifiedName: account.VerifiedName,
        VerifiedAt: account.VerifiedAt,
      });

    if (!env.RAZORPAY_ACCOUNT_NUMBER)
      throw new ApiError(500, "Razorpay account number is not configured");

    const authToken = Buffer.from(
      `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    let razorpayResult: { status: string; registeredName?: string };

    try {
      const { data } = await axios.post(
        "https://api.razorpay.com/v1/fund_accounts/validations",
        {
          account_number: env.RAZORPAY_ACCOUNT_NUMBER,
          fund_account: {
            account_type: "bank_account",
            bank_account: {
              name: account.AccountHolderName,
              ifsc: account.IFSC,
              account_number: account.AccountNumber,
            },
            contact: { name: account.AccountHolderName },
          },
          amount: 100,
          currency: "INR",
          notes: {},
        },
        { headers: { Authorization: `Basic ${authToken}` } }
      );

      razorpayResult = {
        status: data.results?.account_status === "active" ? "verified" : "failed",
        registeredName: data.results?.registered_name,
      };
    } catch (err: any) {
      const razorpayError = err?.response?.data?.error?.description ?? "Razorpay validation failed";
      throw ApiError.badRequest(razorpayError);
    }

    if (razorpayResult.status === "verified") {
      await bankAccountRepository.updateById(account._id!, {
        IsVerified: true,
        VerificationStatus: "verified",
        VerifiedAt: new Date(),
        VerifiedName: razorpayResult.registeredName ?? account.AccountHolderName,
      });
      return sendResponse(res, HTTP_STATUS.OK, "Bank account verified successfully", {
        IsVerified: true,
        VerificationStatus: "verified",
        VerifiedName: razorpayResult.registeredName,
      });
    }

    await bankAccountRepository.updateById(account._id!, {
      IsVerified: false,
      VerificationStatus: "failed",
    });
    throw ApiError.badRequest(
      "Bank account verification failed. Please check your account number and IFSC code."
    );
  }
);
