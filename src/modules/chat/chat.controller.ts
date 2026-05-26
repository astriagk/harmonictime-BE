import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../shared/middlewares/asyncHandler";
import { ApiError } from "../../shared/utils/apiError";
import { sendResponse } from "../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../shared/constants/httpStatus";
import { productRepository } from "../catalog/product/product.repository";
import { chatThreadRepository, chatMessageRepository } from "./chat.repository";
import { maskSensitiveContent } from "./chat.filter";

// Buyer creates or fetches an existing thread for a product.
export const createOrGetThread = asyncHandler(async (req: Request, res: Response) => {
  const buyerId = req.user!.userId;
  const { productId } = req.body;

  const product = await productRepository.findById(productId);
  if (!product) throw ApiError.notFound("Product not found");

  const sellerId = product.UserID.toString();
  if (sellerId === buyerId) throw ApiError.badRequest("You cannot chat about your own product");

  const existing = await chatThreadRepository.findExisting(productId, buyerId);
  if (existing) {
    const enriched = await chatThreadRepository.getEnrichedById(existing._id!);
    return sendResponse(res, HTTP_STATUS.OK, "Thread fetched", enriched);
  }

  const now = new Date();
  const result = await chatThreadRepository.insertOne({
    ProductID: new ObjectId(productId),
    BuyerID: new ObjectId(buyerId),
    SellerID: new ObjectId(sellerId),
    Status: "open",
    CreatedAt: now,
    UpdatedAt: now,
  });

  const thread = await chatThreadRepository.getEnrichedById(result.insertedId);
  sendResponse(res, HTTP_STATUS.CREATED, "Thread created", thread);
});

// Get all threads for the authenticated user — works for buyers, sellers, or both.
export const getMyThreads = asyncHandler(async (req: Request, res: Response) => {
  const threads = await chatThreadRepository.getEnrichedForUser(req.user!.userId);
  sendResponse(res, HTTP_STATUS.OK, "Threads fetched", threads);
});

// Get all messages in a thread (only participants can access).
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { threadId } = req.params;

  const thread = await chatThreadRepository.findById(threadId);
  if (!thread) throw ApiError.notFound("Thread not found");

  const isBuyer = thread.BuyerID.toString() === userId;
  const isSeller = thread.SellerID.toString() === userId;
  if (!isBuyer && !isSeller) throw ApiError.unauthorized("Access denied");

  const readerRole = isBuyer ? "buyer" : "seller";
  const messages = await chatMessageRepository.findByThread(threadId);

  // Mark incoming messages as read on fetch.
  await chatMessageRepository.markThreadRead(threadId, readerRole);

  sendResponse(res, HTTP_STATUS.OK, "Messages fetched", messages);
});

// REST fallback: send a message (the Socket.io gateway is the preferred path).
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { threadId } = req.params;
  const { text } = req.body;

  const thread = await chatThreadRepository.findById(threadId);
  if (!thread) throw ApiError.notFound("Thread not found");
  if (thread.Status === "closed") throw ApiError.badRequest("This thread is closed");

  const isBuyer = thread.BuyerID.toString() === userId;
  const isSeller = thread.SellerID.toString() === userId;
  if (!isBuyer && !isSeller) throw ApiError.unauthorized("Access denied");

  const result = await chatMessageRepository.insertOne({
    ThreadID: new ObjectId(threadId),
    SenderID: new ObjectId(userId),
    SenderRole: isBuyer ? "buyer" : "seller",
    Text: maskSensitiveContent(text),
    IsRead: false,
    CreatedAt: new Date(),
  });

  await chatThreadRepository.updateById(threadId, { UpdatedAt: new Date() } as any);

  const message = await chatMessageRepository.findById(result.insertedId);
  sendResponse(res, HTTP_STATUS.CREATED, "Message sent", message);
});

// Seller closes a thread.
export const closeThread = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { threadId } = req.params;

  const thread = await chatThreadRepository.findById(threadId);
  if (!thread) throw ApiError.notFound("Thread not found");
  if (thread.SellerID.toString() !== userId) throw ApiError.unauthorized("Only the seller can close a thread");

  await chatThreadRepository.updateById(threadId, { Status: "closed", UpdatedAt: new Date() } as any);
  sendResponse(res, HTTP_STATUS.OK, "Thread closed");
});
