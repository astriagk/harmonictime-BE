import { Request, Response } from "express";
import crypto from "crypto";
import { Filter, ObjectId } from "mongodb";
import { Product } from "../../catalog/product/product.types";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { razorpay } from "../../../shared/config/razorpay";
import { env } from "../../../shared/config/env";
import { paymentRepository } from "./payment.repository";
import { addressRepository } from "../../users/address/address.repository";
import { checkoutRepository } from "../checkout/checkout.repository";
import { userRepository } from "../../users/user/user.repository";
import { productRepository } from "../../catalog/product/product.repository";
import { earningRepository } from "../../wallet/earning";
import { cartRepository } from "../../shopping/cart/cart.repository";
import { sendTemplateEmail } from "../../../shared/services/email.service";
import { orderConfirmationEmail } from "../../../shared/email-templates";
import logger from "../../../shared/utils/logger";
import { generateOrderID, generateItemID } from "../../../shared/utils/orderIdGenerator";

// Create a Razorpay order for a checkout. The address + checkout data is stashed
// as a draft on a pending Payment record and is NOT written to the Address /
// Checkout collections until the payment is verified (see verifyPayment).
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { UserID, amount, currency, address, checkout } = req.body;

  if (!(await userRepository.findById(UserID)))
    throw ApiError.badRequest("Invalid UserID");

  // Stock/availability gate: never let the user reach the payment sheet for
  // products that are sold out, hidden, or deleted. Checked here, BEFORE the
  // Razorpay order exists, and re-checked at verifyPayment to close the race
  // window where stock is depleted between order creation and payment.
  const productIds: string[] = checkout?.ProductIDs ?? [];
  if (!Array.isArray(productIds) || productIds.length === 0)
    throw ApiError.badRequest("No products in the order");

  const issues = await productRepository.checkAvailability(productIds);
  if (issues.length > 0)
    throw ApiError.badRequest(
      "Some items can no longer be purchased. Please review your cart.",
      issues
    );

  // Razorpay requires the amount as a positive integer in the smallest currency
  // unit (paise). Round to absorb float artifacts like 514897.99999999994.
  const amountInPaise = Math.round(amount);
  if (!Number.isFinite(amountInPaise) || amountInPaise < 100)
    throw ApiError.badRequest("Invalid amount");

  const receipt = `rcpt_${Date.now()}`;
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: currency || "INR",
    receipt,
  });

  await paymentRepository.insertOne({
    UserID: new ObjectId(UserID),
    Amount: amountInPaise,
    Currency: currency || "INR",
    RazorpayOrderID: order.id,
    PaymentStatus: "Created",
    Receipt: receipt,
    Draft: { address, checkout },
    CreatedAt: new Date(),
  });

  // key_id lets the frontend open Checkout with the SAME key the order was
  // created under. Existing order fields (id, amount, currency, ...) preserved.
  sendResponse(res, HTTP_STATUS.CREATED, "Order created successfully", {
    ...order,
    key_id: env.RAZORPAY_KEY_ID,
  });
});

// Verify the Razorpay signature. ONLY on success do we create the Address and
// Checkout, then mark the Payment verified — so abandoned/failed payments never
// leave orphaned address or checkout records.
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, PaymentMethod } =
    req.body;

  const payment = await paymentRepository.findByRazorpayOrderId(razorpay_order_id);
  if (!payment) throw ApiError.badRequest("Payment record not found");

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    await paymentRepository.updateById(payment._id!, { PaymentStatus: "Failed" });
    throw ApiError.badRequest("Payment verification failed");
  }

  // Idempotency: if a retry hits an already-finalized payment, return what was
  // created the first time rather than creating duplicates.
  if (payment.PaymentStatus === "Verified" && payment.CheckoutID) {
    sendResponse(res, HTTP_STATUS.OK, "Payment already verified", {
      CheckoutID: payment.CheckoutID,
      AddressID: payment.AddressID,
    });
    return;
  }

  const draft = payment.Draft;
  if (!draft) throw ApiError.badRequest("No draft order data found for this payment");

  // Re-validate stock now that money has been captured. Another buyer may have
  // taken the last unit between createOrder and here. If so, do NOT materialize
  // the checkout — flag the payment for refund and surface the issues. The
  // failing items are stored on the payment so a refund/ops flow can act on it.
  const stockIssues = await productRepository.checkAvailability(
    draft.checkout.ProductIDs
  );
  if (stockIssues.length > 0) {
    await paymentRepository.updateById(payment._id!, {
      PaymentStatus: "RefundPending",
      RazorpayPaymentID: razorpay_payment_id,
      RazorpaySignature: razorpay_signature,
    });
    throw ApiError.conflict(
      "Payment received, but some items sold out before the order could be confirmed. A refund will be issued."
    );
  }

  // 1. Resolve address: reuse an existing saved address or create a new one.
  let AddressID: ObjectId;
  let resolvedAddress: { FirstName: string; LastName: string; Phone: string; AddressLine1: string; AddressLine2?: string; City: string; State: string; PostalCode: string; Country: string; };
  if (draft.address._id) {
    // Existing address — verify it belongs to this buyer before trusting it.
    const existing = await addressRepository.findById(draft.address._id);
    if (!existing || existing.UserID.toString() !== payment.UserID.toString())
      throw ApiError.badRequest("Selected address not found");
    AddressID = existing._id!;
    resolvedAddress = existing;
  } else {
    const addressResult = await addressRepository.insertOne({
      UserID: payment.UserID,
      FirstName: draft.address.FirstName!,
      LastName: draft.address.LastName!,
      Country: draft.address.Country!,
      AddressLine1: draft.address.AddressLine1!,
      AddressLine2: draft.address.AddressLine2 || "",
      City: draft.address.City!,
      State: draft.address.State!,
      PostalCode: draft.address.PostalCode!,
      Phone: draft.address.Phone!,
      orderNotes: draft.address.orderNotes,
      IsDefault: draft.address.IsDefault || false,
    });
    AddressID = addressResult.insertedId;
    resolvedAddress = {
      FirstName: draft.address.FirstName!,
      LastName: draft.address.LastName!,
      Phone: draft.address.Phone!,
      AddressLine1: draft.address.AddressLine1!,
      AddressLine2: draft.address.AddressLine2,
      City: draft.address.City!,
      State: draft.address.State!,
      PostalCode: draft.address.PostalCode!,
      Country: draft.address.Country!,
    };
  }

  // 2. Create the checkout referencing the new address.
  const orderedProductIDs = draft.checkout.ProductIDs.map((id) => new ObjectId(id));
  const orderID = generateOrderID();
  const orderItems = orderedProductIDs.map((pid) => ({
    ProductID: pid,
    OrderItemID: generateItemID(),
  }));

  const checkoutResult = await checkoutRepository.insertOne({
    OrderID: orderID,
    UserID: payment.UserID,
    AddressID,
    TotalAmount: draft.checkout.TotalAmount,
    PaymentStatus: "Paid",
    DeliveryStatus: draft.checkout.DeliveryStatus || "Pending",
    CheckoutDate: draft.checkout.CheckoutDate
      ? new Date(draft.checkout.CheckoutDate)
      : new Date(),
    ProductIDs: orderedProductIDs,
    OrderItems: orderItems,
  });
  const CheckoutID = checkoutResult.insertedId;

  // 2b. Credit each seller's wallet: one Pending earning per sold product, with
  //     the sale price and active offer snapshotted at this moment so later
  //     price/offer changes never rewrite history. Becomes withdrawable only
  //     after delivery + the hold window (see earning module).
  const soldProductIds = draft.checkout.ProductIDs.map((id) => new ObjectId(id));
  const soldProducts = await productRepository.findWithActiveOffer(soldProductIds);
  await earningRepository.createForCheckout(
    CheckoutID,
    soldProducts.map((p) => ({
      _id: p._id,
      UserID: p.UserID,
      Price: p.Price,
      OfferDiscountPercentage: p.OfferDiscountPercentage ?? 0,
      IsPriceInclusiveOfTax: p.IsPriceInclusiveOfTax ?? false,
    }))
  );

  // 2c. Auto-update IsAvailable based on remaining stock after this sale.
  //     Products that just sold out → IsAvailable = false (hidden from marketplace).
  //     Products with stock remaining → IsAvailable = true (ensure not incorrectly hidden).
  const uniqueSoldIds = [...new Set(soldProductIds.map((id) => id.toString()))].map(
    (id) => new ObjectId(id)
  );
  const enrichedAfterSale = await productRepository.getEnrichedWithStatus({
    _id: { $in: uniqueSoldIds },
  } as Filter<Product>);
  const soldOut = enrichedAfterSale
    .filter((p) => (p.RemainingQuantity ?? 0) <= 0)
    .map((p) => p._id);
  const stillInStock = enrichedAfterSale
    .filter((p) => (p.RemainingQuantity ?? 0) > 0)
    .map((p) => p._id);
  if (soldOut.length > 0) await productRepository.setAvailability(soldOut, false);
  if (stillInStock.length > 0) await productRepository.setAvailability(stillInStock, true);

  // 3. Remove purchased items from the buyer's cart.
  await cartRepository.removeByUserAndProducts(payment.UserID, soldProductIds);

  // 4. Finalize the payment and link the records it produced.
  await paymentRepository.updateById(payment._id!, {
    RazorpayPaymentID: razorpay_payment_id,
    RazorpaySignature: razorpay_signature,
    PaymentMethod,
    PaymentStatus: "Verified",
    PaidAt: new Date(),
    CheckoutID,
    AddressID,
  });

  // 5. Send order confirmation email with invoice to the buyer.
  //    Fire-and-forget: a failed email must never affect the payment response.
  (async () => {
    try {
      const buyer = await userRepository.findById(payment.UserID.toString());
      if (!buyer?.email) return;

      // Join product names (enrichedAfterSale) with price/offer data (soldProducts).
      const nameMap = new Map<string, string>(
        enrichedAfterSale.map((p: any) => [p._id.toString(), p.ProductName as string])
      );

      const lineItems = soldProducts.map((p) => {
        const offerPercentage = p.OfferDiscountPercentage ?? 0;
        const offerAmount = Math.round(p.Price * offerPercentage / 100);
        const grossAmount = p.Price - offerAmount;
        const buyerCommission = Math.round(grossAmount * env.BUYER_COMMISSION_RATE);
        const amount = grossAmount + buyerCommission;
        return {
          productName: nameMap.get(p._id.toString()) ?? "Product",
          mrp: amount + offerAmount,
          offerPercentage,
          offerAmount,
          amount,
          isTaxInclusive: p.IsPriceInclusiveOfTax ?? false,
        };
      });

      const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0);
      // GST is charged only on items whose price does not already include tax.
      const taxExclusiveSubtotal = lineItems
        .filter((i) => !i.isTaxInclusive)
        .reduce((sum, i) => sum + i.amount, 0);
      const gst = Math.round(taxExclusiveSubtotal * env.GST_RATE / 100);

      await sendTemplateEmail(
        buyer.email,
        orderConfirmationEmail({
          invoiceNumber: orderID,
          buyerEmail: buyer.email,
          buyerName: `${resolvedAddress.FirstName} ${resolvedAddress.LastName}`,
          buyerPhone: resolvedAddress.Phone,
          buyerAddressLine1: resolvedAddress.AddressLine1,
          buyerAddressLine2: resolvedAddress.AddressLine2,
          buyerCity: resolvedAddress.City,
          buyerState: resolvedAddress.State,
          buyerPostalCode: resolvedAddress.PostalCode,
          buyerCountry: resolvedAddress.Country,
          issuedOn: draft.checkout.CheckoutDate
            ? new Date(draft.checkout.CheckoutDate)
            : new Date(),
          items: lineItems,
          subtotal,
          gst,
          total: subtotal + gst,
        })
      );
    } catch (err) {
      logger.error(`Order confirmation email failed: ${err}`);
    }
  })();

  sendResponse(res, HTTP_STATUS.OK, "Payment verified successfully", {
    CheckoutID,
    AddressID,
    OrderID: orderID,
    OrderItems: orderItems.map((item) => ({
      ProductID: item.ProductID,
      OrderItemID: item.OrderItemID,
    })),
  });
});

export const getPaymentsByCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    const payments = await paymentRepository.findByCheckout(req.params.checkoutID);
    sendResponse(res, HTTP_STATUS.OK, "Payments retrieved successfully", payments);
  }
);
