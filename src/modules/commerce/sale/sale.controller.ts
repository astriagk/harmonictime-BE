import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { saleRepository } from "./sale.repository";
import { userRepository } from "../../users/user/user.repository";
import { productRepository } from "../../catalog/product/product.repository";
import { offerRepository } from "../offer/offer.repository";

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const { BuyerID, SellerID, ProductID, OfferID, SaleDate, SalePrice, DiscountAmount, FinalPrice } =
    req.body;

  if (!(await userRepository.findById(BuyerID)))
    throw ApiError.badRequest("Invalid BuyerID");
  if (!(await userRepository.findById(SellerID)))
    throw ApiError.badRequest("Invalid SellerID");
  if (!(await productRepository.findById(ProductID)))
    throw ApiError.badRequest("Invalid ProductID");

  let offerObjectId: ObjectId | null = null;
  if (OfferID) {
    if (!(await offerRepository.findById(OfferID)))
      throw ApiError.badRequest("Invalid OfferID");
    offerObjectId = new ObjectId(OfferID);
  }

  const result = await saleRepository.insertOne({
    BuyerID: new ObjectId(BuyerID),
    SellerID: new ObjectId(SellerID),
    ProductID: new ObjectId(ProductID),
    OfferID: offerObjectId,
    SaleDate: new Date(SaleDate),
    SalePrice,
    DiscountAmount: DiscountAmount || 0,
    FinalPrice,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Sale created successfully", result);
});

export const getSaleById = asyncHandler(async (req: Request, res: Response) => {
  const sale = await saleRepository.findById(req.params.saleID);
  if (!sale) throw ApiError.notFound("Sale not found");
  sendResponse(res, HTTP_STATUS.OK, "", sale);
});

export const getAllSalesByUserID = asyncHandler(
  async (req: Request, res: Response) => {
    const sales = await saleRepository.findByBuyer(req.params.userID);
    sendResponse(res, HTTP_STATUS.OK, "Sales retrieved successfully", sales);
  }
);

export const deleteSale = asyncHandler(async (req: Request, res: Response) => {
  const result = await saleRepository.deleteById(req.params.saleID);
  if (result.deletedCount === 0) throw ApiError.notFound("Sale not found");
  sendResponse(res, HTTP_STATUS.OK, "Sale deleted successfully");
});
