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
    } = req.body;

    if (OfferID && !ObjectId.isValid(OfferID))
      throw ApiError.badRequest("Invalid OfferID");

    const doc: Product = {
      UserID: new ObjectId(UserID),
      ProductName,
      BrandID: new ObjectId(BrandID),
      CollectionID: new ObjectId(CollectionID),
      CategoryID: new ObjectId(CategoryID),
      RecipientID: new ObjectId(RecipientID),
      Price,
      Quantity,
      OfferID: OfferID ? new ObjectId(OfferID) : null,
      IsAvailable: true,
      DateListed: new Date(),
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

    const enriched = await productRepository.getEnriched({ _id });
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
