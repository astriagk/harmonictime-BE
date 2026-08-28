import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Single source of truth for how a product's price becomes (a) what the buyer
// pays and (b) what the seller is credited. Every storefront pipeline, the
// checkout, and the wallet MUST derive their numbers from here so the buyer's
// charge and the seller's earning can never drift apart.
//
// The chain, per unit:
//
//   EffectivePrice = Price − offer discount            (seller's taxable value)
//   GSTAmount      = tax-exclusive ? 18% of Effective : 0
//                      · exclusive → GST is collected from the buyer on top and
//                        passed through to the seller, who remits it.
//                      · inclusive → GST already sits inside Price; nothing is
//                        added and nothing is deducted. The seller remits it.
//   TaxedPrice     = EffectivePrice + GSTAmount        (commission base)
//   Buyer  pays    = TaxedPrice + round(TaxedPrice × BUYER_COMMISSION_RATE)
//   Seller gets    = TaxedPrice − round(TaxedPrice × PLATFORM_COMMISSION_RATE)
//
// The platform's only revenue is the two commissions. GST is never platform
// money: it is either untouched inside the price, or a pass-through that
// arrives from the buyer and leaves to the seller.
//
// Worked example — ₹1000, no offer, both rates 2%, GST 18%:
//   exclusive: GST 180 → taxed 1180 → buyer 1204, seller 1156, platform 48
//   inclusive: GST   0 → taxed 1000 → buyer 1020, seller  980, platform 40
// ---------------------------------------------------------------------------

export interface UnitPricing {
  Price: number;                   // seller's listed price
  OfferDiscountPercentage: number;
  OfferDiscountAmount: number;
  EffectivePrice: number;          // Price − OfferDiscountAmount
  IsTaxInclusive: boolean;
  GSTRate: number;                 // % (e.g. 18)
  GSTAmount: number;               // collected from the buyer; 0 when inclusive
  TaxedPrice: number;              // EffectivePrice + GSTAmount — the commission base
  BuyerCommissionRate: number;
  BuyerCommissionAmount: number;
  DisplayPrice: number;            // what the buyer pays per unit
  SellerCommissionRate: number;
  SellerCommissionAmount: number;
  NetAmount: number;               // EffectivePrice − SellerCommissionAmount (GST excluded)
  NetPayableAmount: number;        // NetAmount + GSTAmount — what actually reaches the seller
}

// Per-unit price breakdown. `isTaxInclusive` comes from Product.IsPriceInclusiveOfTax.
export function computeUnitPricing(
  price: number,
  offerDiscountPercentage = 0,
  isTaxInclusive = false
): UnitPricing {
  const gstRate = env.GST_RATE;
  const buyerRate = env.BUYER_COMMISSION_RATE;
  const sellerRate = env.PLATFORM_COMMISSION_RATE;

  const offerDiscountAmount = Math.round((price * offerDiscountPercentage) / 100);
  const effectivePrice = price - offerDiscountAmount;

  const gstAmount = isTaxInclusive
    ? 0
    : Math.round((effectivePrice * gstRate) / 100);
  const taxedPrice = effectivePrice + gstAmount;

  const buyerCommissionAmount = Math.round(taxedPrice * buyerRate);
  const sellerCommissionAmount = Math.round(taxedPrice * sellerRate);

  return {
    Price: price,
    OfferDiscountPercentage: offerDiscountPercentage,
    OfferDiscountAmount: offerDiscountAmount,
    EffectivePrice: effectivePrice,
    IsTaxInclusive: isTaxInclusive,
    GSTRate: gstRate,
    GSTAmount: gstAmount,
    TaxedPrice: taxedPrice,
    BuyerCommissionRate: buyerRate,
    BuyerCommissionAmount: buyerCommissionAmount,
    DisplayPrice: taxedPrice + buyerCommissionAmount,
    SellerCommissionRate: sellerRate,
    SellerCommissionAmount: sellerCommissionAmount,
    NetAmount: effectivePrice - sellerCommissionAmount,
    NetPayableAmount: taxedPrice - sellerCommissionAmount,
  };
}

// ------------------------------- aggregation -------------------------------
// Mirrors of the above for $project/$addFields stages. `priceExpr` must already
// have any offer discount applied; `inclusiveExpr` resolves to a boolean.

type Expr = unknown;

export const inclusiveFlagExpr = (field: string): Expr => ({
  $ifNull: [field, false],
});

// GST collected from the buyer: 0 when the price is already tax-inclusive.
export const gstAmountExpr = (priceExpr: Expr, inclusiveExpr: Expr): Expr => ({
  $cond: [
    inclusiveExpr,
    0,
    { $round: [{ $multiply: [priceExpr, env.GST_RATE / 100] }, 0] },
  ],
});

// EffectivePrice + GST — the base both commissions are charged on.
export const taxedPriceExpr = (priceExpr: Expr, inclusiveExpr: Expr): Expr => ({
  $add: [priceExpr, gstAmountExpr(priceExpr, inclusiveExpr)],
});

export const buyerCommissionExpr = (priceExpr: Expr, inclusiveExpr: Expr): Expr => ({
  $round: [
    { $multiply: [taxedPriceExpr(priceExpr, inclusiveExpr), env.BUYER_COMMISSION_RATE] },
    0,
  ],
});

// What the buyer pays per unit = EffectivePrice + GST + buyer commission.
export const displayPriceExpr = (priceExpr: Expr, inclusiveExpr: Expr): Expr => ({
  $add: [
    taxedPriceExpr(priceExpr, inclusiveExpr),
    buyerCommissionExpr(priceExpr, inclusiveExpr),
  ],
});
