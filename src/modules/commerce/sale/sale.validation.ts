import Joi from "joi";

export const createSaleSchema = Joi.object({
  BuyerID: Joi.string().required(),
  SellerID: Joi.string().required(),
  ProductID: Joi.string().required(),
  OfferID: Joi.string().allow(null, "").optional(),
  SaleDate: Joi.date().required(),
  SalePrice: Joi.number().required(),
  DiscountAmount: Joi.number().optional(),
  FinalPrice: Joi.number().required(),
});
