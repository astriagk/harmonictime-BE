import { ObjectId } from "mongodb";
import { BaseRepository } from "../../shared/database/base.repository";
import { COLLECTIONS } from "../../shared/constants/collections";
import { ChatThread, ChatMessage } from "./chat.types";

class ChatThreadRepository extends BaseRepository<ChatThread> {
  constructor() {
    super(COLLECTIONS.CHAT_THREADS);
  }

  findByProduct(productId: string | ObjectId) {
    return this.find({ ProductID: this.toObjectId(productId) });
  }

  findByBuyer(buyerId: string | ObjectId) {
    return this.find({ BuyerID: this.toObjectId(buyerId) });
  }

  findBySeller(sellerId: string | ObjectId) {
    return this.find({ SellerID: this.toObjectId(sellerId) });
  }

  findExisting(productId: string | ObjectId, buyerId: string | ObjectId) {
    return this.findOne({
      ProductID: this.toObjectId(productId),
      BuyerID: this.toObjectId(buyerId),
    });
  }

  getEnriched(matchStage: object) {
    return this.aggregate([
      { $match: matchStage },
      // Product basics
      {
        $lookup: {
          from: COLLECTIONS.PRODUCTS,
          localField: "ProductID",
          foreignField: "_id",
          as: "Product",
        },
      },
      { $unwind: { path: "$Product", preserveNullAndEmptyArrays: true } },
      // Product description (Title + short Content)
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_DESCRIPTION,
          localField: "ProductID",
          foreignField: "ProductID",
          as: "ProductDescription",
        },
      },
      { $unwind: { path: "$ProductDescription", preserveNullAndEmptyArrays: true } },
      // Primary image only
      {
        $lookup: {
          from: COLLECTIONS.PRODUCT_IMAGES,
          let: { pid: "$ProductID" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$ProductID", "$$pid"] }, { $eq: ["$IsPrimary", true] }] } } },
            { $limit: 1 },
          ],
          as: "PrimaryImageArr",
        },
      },
      // Participants
      {
        $lookup: {
          from: COLLECTIONS.USERS,
          localField: "BuyerID",
          foreignField: "_id",
          as: "Buyer",
        },
      },
      { $unwind: { path: "$Buyer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: COLLECTIONS.USERS,
          localField: "SellerID",
          foreignField: "_id",
          as: "Seller",
        },
      },
      { $unwind: { path: "$Seller", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          Status: 1,
          CreatedAt: 1,
          UpdatedAt: 1,
          Product: {
            _id: 1,
            ProductName: 1,
            Price: 1,
            Description: {
              Title: "$ProductDescription.Title",
              // Trim long descriptions — frontend uses this as a preview blurb.
              Content: { $substrCP: ["$ProductDescription.Content", 0, 200] },
            },
            PrimaryImage: { $arrayElemAt: ["$PrimaryImageArr.ImageURL", 0] },
          },
          Buyer: { _id: 1, email: 1 },
          Seller: { _id: 1, email: 1 },
        },
      },
      { $sort: { UpdatedAt: -1 } },
    ]);
  }

  getEnrichedById(threadId: string | ObjectId) {
    return this.getEnriched({ _id: this.toObjectId(threadId) }).then(
      (rows) => rows[0] ?? null
    );
  }

  // Returns every thread the user participates in, regardless of role.
  getEnrichedForUser(userId: string | ObjectId) {
    const id = this.toObjectId(userId);
    return this.getEnriched({ $or: [{ BuyerID: id }, { SellerID: id }] });
  }
}

class ChatMessageRepository extends BaseRepository<ChatMessage> {
  constructor() {
    super(COLLECTIONS.CHAT_MESSAGES);
  }

  findByThread(threadId: string | ObjectId) {
    return this.collection
      .find({ ThreadID: this.toObjectId(threadId) })
      .sort({ CreatedAt: 1 })
      .toArray();
  }

  markThreadRead(threadId: string | ObjectId, readerRole: "buyer" | "seller") {
    const senderRole = readerRole === "buyer" ? "seller" : "buyer";
    return this.updateMany(
      { ThreadID: this.toObjectId(threadId), SenderRole: senderRole, IsRead: false },
      { $set: { IsRead: true } }
    );
  }

  countUnread(threadId: string | ObjectId, readerRole: "buyer" | "seller") {
    const senderRole = readerRole === "buyer" ? "seller" : "buyer";
    return this.collection.countDocuments({
      ThreadID: this.toObjectId(threadId),
      SenderRole: senderRole,
      IsRead: false,
    });
  }
}

export const chatThreadRepository = new ChatThreadRepository();
export const chatMessageRepository = new ChatMessageRepository();
