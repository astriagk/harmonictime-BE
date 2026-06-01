import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { cartRepository } from "./cart.repository";
import { userRepository } from "../../users/user/user.repository";
import { productRepository } from "../../catalog/product/product.repository";

export const addProductToCart = asyncHandler(async (req: Request, res: Response) => {
  const { UserID, ProductID, Quantity } = req.body;
  const userObjectId = new ObjectId(UserID);
  const productObjectId = new ObjectId(ProductID);

  if (!(await userRepository.findById(userObjectId)))
    throw ApiError.badRequest("Invalid UserID");

  const requestedQty = Quantity || 1;
  const [stock] = await productRepository.getEnrichedWithStatus({ _id: productObjectId });
  if (!stock) throw ApiError.badRequest("Invalid ProductID");
  if (stock.RemainingQuantity < requestedQty)
    throw ApiError.badRequest(`Only ${stock.RemainingQuantity} unit(s) available`);

  const existing = await cartRepository.findByUserAndProduct(userObjectId, productObjectId);
  if (existing) throw ApiError.conflict("Product already in cart");

  const result = await cartRepository.insertOne({
    UserID: userObjectId,
    ProductID: productObjectId,
    Quantity: requestedQty,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Product added to cart successfully", result);
});

export const getCartByUserID = asyncHandler(async (req: Request, res: Response) => {
  const items = await cartRepository.getEnrichedByUser(new ObjectId(req.params.userID));
  sendResponse(res, HTTP_STATUS.OK, "Cart retrieved successfully", items);
});

export const getCartItemByProduct = asyncHandler(async (req: Request, res: Response) => {
  const item = await cartRepository.findByUserAndProduct(
    new ObjectId(req.params.userID),
    new ObjectId(req.params.productID)
  );
  if (!item) throw ApiError.notFound("Product not found in cart");
  sendResponse(res, HTTP_STATUS.OK, "Cart item retrieved successfully", item);
});

export const updateCartProductQuantity = asyncHandler(
  async (req: Request, res: Response) => {
    const cartItem = await cartRepository.findById(req.params.cartID);
    if (!cartItem) throw ApiError.notFound("Cart item not found");

    const [stock] = await productRepository.getEnrichedWithStatus({ _id: cartItem.ProductID });
    if (!stock || stock.RemainingQuantity < req.body.Quantity)
      throw ApiError.badRequest(`Only ${stock?.RemainingQuantity ?? 0} unit(s) available`);

    const result = await cartRepository.updateById(req.params.cartID, {
      Quantity: req.body.Quantity,
    });
    if (result.matchedCount === 0) throw ApiError.notFound("Cart item not found");
    sendResponse(res, HTTP_STATUS.OK, "Product quantity updated in cart");
  }
);

export const removeProductFromCart = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await cartRepository.deleteById(req.params.cartID);
    if (result.deletedCount === 0) throw ApiError.notFound("Cart item not found");
    sendResponse(res, HTTP_STATUS.OK, "Product removed from cart successfully");
  }
);
