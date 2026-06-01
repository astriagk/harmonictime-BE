import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { productRepository } from "./product.repository";
import { Product } from "./product.types";
import { productImageRepository } from "../product_image/product_image.repository";
import { offerRepository } from "../../commerce/offer";
import { deleteFile } from "../../../shared/services/file-storage.service";
import { gstRepository } from "../../users/gst/gst.repository";
import { earningRepository } from "../../wallet/earning/earning.repository";
import { env } from "../../../shared/config/env";

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      UserID,
      ProductName,
      BrandID,
      CollectionID,
      CategoryID,
      Price,
      RecipientID,
      Quantity,
      OfferID,
      IsPriceInclusiveOfTax,
    } = req.body;

    if (OfferID && !ObjectId.isValid(OfferID))
      throw ApiError.badRequest("Invalid OfferID");

    // GST threshold check: if the seller's cumulative gross sales have crossed
    // the configured threshold (default ₹2,00,000), they must have GST details
    // on file before listing new products.
    const sellerObjId = new ObjectId(UserID);
    const totalGrossSales = await earningRepository.getTotalGrossSales(sellerObjId);
    if (totalGrossSales >= env.SELLER_GST_THRESHOLD) {
      const gstDetails = await gstRepository.findBySeller(sellerObjId);
      if (!gstDetails) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Your total sales have crossed ₹${env.SELLER_GST_THRESHOLD.toLocaleString("en-IN")}. Please add your GST details before listing new products.`
        );
      }
    }

    const doc: Product = {
      UserID: sellerObjId,
      ProductName,
      BrandID: new ObjectId(BrandID),
      CollectionID: CollectionID ? new ObjectId(CollectionID) : null,
      CategoryID: new ObjectId(CategoryID),
      RecipientID: RecipientID ? new ObjectId(RecipientID) : null,
      Price,
      Quantity,
      OfferID: OfferID ? new ObjectId(OfferID) : null,
      IsAvailable: true,
      DateListed: new Date(),
      IsPriceInclusiveOfTax: IsPriceInclusiveOfTax ?? false,
      ApprovalStatus: "Pending",
    };
    const result = await productRepository.insertOne(doc);
    sendResponse(
      res,
      HTTP_STATUS.CREATED,
      "Product created successfully",
      result,
    );
  },
);

export const getAllProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { UserID, IsAvailable } = req.query;
    const match: Filter<Product> = {};
    if (UserID) match.UserID = new ObjectId(UserID as string);

    // IsAvailable filter:
    //   "true"  → only available
    //   "false" → only unavailable
    //   "all"   → no availability filter (every product)
    //   omitted + UserID present  → no filter (sellers see all their listings)
    //   omitted + no UserID       → default to available only (buyer marketplace)
    if (IsAvailable === "true") match.IsAvailable = true;
    else if (IsAvailable === "false") match.IsAvailable = false;
    else if (IsAvailable !== "all" && !UserID) match.IsAvailable = true;

    // Buyers (no UserID filter) only see admin-approved products.
    // Sellers querying their own listings see everything (pending, rejected, approved).
    if (!UserID) (match as any).ApprovalStatus = "Approved";

    // getEnrichedWithStatus tags each product with Status (Sold / Available /
    // Unavailable) and IsSold, derived from paid checkouts.
    const products = await productRepository.getEnrichedWithStatus(match);
    sendResponse(
      res,
      HTTP_STATUS.OK,
      "Products retrieved successfully.",
      products,
    );
  },
);

export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const _id = new ObjectId(req.params.productID);
    const product = await productRepository.findById(_id);
    if (!product) throw ApiError.notFound("Product not found");

    // Non-approved products are invisible to public callers.
    // The seller who owns the product can always fetch it regardless of status.
    const approvalStatus = (product as any).ApprovalStatus ?? "Approved";
    const isOwner = req.user?.userId === (product as any).UserID?.toString();
    if (approvalStatus !== "Approved" && !isOwner)
      throw ApiError.notFound("Product not found");

    const enriched = await productRepository.getEnrichedWithStatus({ _id });
    sendResponse(res, HTTP_STATUS.OK, "ProductDetails Data !", enriched);
  },
);

// Soft-delete: mark a batch of products unavailable.
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const ids = (req.body.ProductIDs as string[]).map((id) => new ObjectId(id));
    const result = await productRepository.setAvailability(ids, false);
    if (result.matchedCount === 0)
      throw ApiError.notFound("No products found with the given IDs");
    sendResponse(
      res,
      HTTP_STATUS.OK,
      `${result.modifiedCount} products updated successfully`,
      result,
    );
  },
);

// Edit core product fields (name, price, brand/collection/category/recipient,
// availability). Only the fields present in the body are changed.
export const editProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productID } = req.params;
  if (!ObjectId.isValid(productID))
    throw ApiError.badRequest("Invalid ProductID");

  const {
    ProductName,
    BrandID,
    CollectionID,
    CategoryID,
    RecipientID,
    Price,
    Quantity,
    OfferID,
    IsAvailable,
    IsPriceInclusiveOfTax,
    RemovedImageIDs,
  } = req.body;

  const idFields: [string, unknown][] = [
    ["BrandID", BrandID],
    ["CollectionID", CollectionID],
    ["CategoryID", CategoryID],
    ["RecipientID", RecipientID],
  ];
  for (const [name, value] of idFields) {
    if (value !== undefined && !ObjectId.isValid(value as string))
      throw ApiError.badRequest(`Invalid ${name}`);
  }

  // OfferID is optional and nullable: a non-empty string must be a valid id
  // (attach/replace the offer); null or "" detaches any existing offer.
  if (OfferID !== undefined && OfferID !== null && OfferID !== "" && !ObjectId.isValid(OfferID))
    throw ApiError.badRequest("Invalid OfferID");

  // Images the user removed on the edit screen. For each, delete the S3 object
  // (deleteFile is idempotent and error-safe) then the DB record. Scoped to
  // this product so an id from another product can't be used to delete its
  // image.
  if (Array.isArray(RemovedImageIDs) && RemovedImageIDs.length > 0) {
    await Promise.all(
      (RemovedImageIDs as string[]).map(async (imageID) => {
        if (!ObjectId.isValid(imageID)) return;
        const image = await productImageRepository.findById(imageID);
        if (!image || image.ProductID.toString() !== productID) return;
        await deleteFile(image.key || image.ImageURL);
        await productImageRepository.deleteById(imageID);
      })
    );
  }

  const update: Partial<Product> = {};
  if (ProductName !== undefined) update.ProductName = ProductName;
  if (Price !== undefined) update.Price = Price;
  if (Quantity !== undefined) update.Quantity = Quantity;
  if (OfferID !== undefined)
    update.OfferID = OfferID ? new ObjectId(OfferID) : null;
  if (IsAvailable !== undefined) update.IsAvailable = IsAvailable;
  if (IsPriceInclusiveOfTax !== undefined) update.IsPriceInclusiveOfTax = IsPriceInclusiveOfTax;
  if (BrandID !== undefined) update.BrandID = new ObjectId(BrandID);
  if (CollectionID !== undefined)
    update.CollectionID = new ObjectId(CollectionID);
  if (CategoryID !== undefined) update.CategoryID = new ObjectId(CategoryID);
  if (RecipientID !== undefined) update.RecipientID = new ObjectId(RecipientID);

  // The request may carry only RemovedImageIDs (no core field changes), which
  // leaves `update` empty. Skip the write in that case — an empty $set errors
  // in MongoDB — but still confirm the product exists.
  if (Object.keys(update).length > 0) {
    const result = await productRepository.updateById(productID, update);
    if (result.matchedCount === 0) throw ApiError.notFound("Product not found");
  } else {
    const exists = await productRepository.findById(productID);
    if (!exists) throw ApiError.notFound("Product not found");
  }

  await productRepository.resubmitIfRejected(productID);

  const [updated] = await productRepository.getEnriched({
    _id: new ObjectId(productID),
  });
  sendResponse(res, HTTP_STATUS.OK, "Product updated successfully", updated);
});

// Bulk offer assignment: attach one offer to many products and/or clear the
// offer from many products in a single request.
//   - AssignProductIDs + OfferID → set OfferID on those products
//   - RemoveProductIDs           → clear OfferID on those products (set null)
// Both arrays are optional but at least one must be present (enforced by schema).
export const bulkUpdateProductOffer = asyncHandler(
  async (req: Request, res: Response) => {
    const { OfferID, AssignProductIDs, RemoveProductIDs } = req.body;

    const assignIds = (AssignProductIDs ?? []) as string[];
    const removeIds = (RemoveProductIDs ?? []) as string[];

    for (const id of [...assignIds, ...removeIds]) {
      if (!ObjectId.isValid(id))
        throw ApiError.badRequest(`Invalid ProductID: ${id}`);
    }

    let assigned = 0;
    let removed = 0;

    if (assignIds.length > 0) {
      if (!OfferID || !ObjectId.isValid(OfferID))
        throw ApiError.badRequest(
          "A valid OfferID is required to assign an offer"
        );
      if (!(await offerRepository.findById(OfferID)))
        throw ApiError.notFound("Offer not found");

      const result = await productRepository.setOffer(
        assignIds.map((id) => new ObjectId(id)),
        new ObjectId(OfferID)
      );
      assigned = result.modifiedCount;
    }

    if (removeIds.length > 0) {
      const result = await productRepository.setOffer(
        removeIds.map((id) => new ObjectId(id)),
        null
      );
      removed = result.modifiedCount;
    }

    sendResponse(res, HTTP_STATUS.OK, "Product offers updated successfully", {
      assigned,
      removed,
    });
  }
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productRepository.deleteById(req.params.productID);
    if (result.deletedCount === 0) throw ApiError.notFound("Product not found");
    sendResponse(res, HTTP_STATUS.OK, "Product deleted successfully");
  },
);

// Pre-flight stock check for the checkout review page. Accepts a list of
// { ProductID, Quantity } items and returns per-item availability so the FE
// can show "Only N left" warnings and block payment if any item is unavailable.
export const checkAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { items } = req.body as { items: { ProductID: string; Quantity: number }[] };

    const flatIds = items.flatMap(({ ProductID, Quantity }) =>
      Array(Quantity).fill(ProductID)
    );

    const issues = await productRepository.checkAvailability(flatIds);
    const issueMap = new Map(issues.map((i) => [i.ProductID, i.reason]));

    const uniqueIds = [...new Set(items.map((i) => i.ProductID))];
    const stocks = await productRepository.getEnrichedWithStatus({
      _id: { $in: uniqueIds.map((id) => new ObjectId(id)) },
    } as Filter<Product>);
    const stockMap = new Map(stocks.map((s) => [s._id.toString(), s]));

    const result = items.map(({ ProductID, Quantity }) => {
      const stock = stockMap.get(ProductID);
      return {
        ProductID,
        RequestedQuantity: Quantity,
        RemainingQuantity: stock?.RemainingQuantity ?? 0,
        Status: stock?.Status ?? "Sold",
        Available: !issueMap.has(ProductID),
        Reason: issueMap.get(ProductID) ?? null,
      };
    });

    const allAvailable = result.every((r) => r.Available);
    sendResponse(res, HTTP_STATUS.OK, "Availability checked", { allAvailable, items: result });
  }
);
