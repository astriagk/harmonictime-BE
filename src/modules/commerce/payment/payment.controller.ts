import { Request, Response } from "express";
import crypto from "crypto";
import { ObjectId } from "mongodb";
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

// Create a Razorpay order for a checkout. The address + checkout data is stashed
// as a draft on a pending Payment record and is NOT written to the Address /
// Checkout collections until the payment is verified (see verifyPayment).
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { UserID, amount, currency, address, checkout } = req.body;

  if (!(await userRepository.findById(UserID)))
    throw ApiError.badRequest("Invalid UserID");

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

  // 1. Create the address now that payment has succeeded.
  const addressResult = await addressRepository.insertOne({
    UserID: payment.UserID,
    FirstName: draft.address.FirstName,
    LastName: draft.address.LastName,
    Country: draft.address.Country,
    AddressLine1: draft.address.AddressLine1,
    AddressLine2: draft.address.AddressLine2 || "",
    City: draft.address.City,
    State: draft.address.State,
    PostalCode: draft.address.PostalCode,
    Phone: draft.address.Phone,
    orderNotes: draft.address.orderNotes,
    IsDefault: draft.address.IsDefault || false,
  });
  const AddressID = addressResult.insertedId;

  // 2. Create the checkout referencing the new address.
  const checkoutResult = await checkoutRepository.insertOne({
    UserID: payment.UserID,
    AddressID,
    TotalAmount: draft.checkout.TotalAmount,
    PaymentStatus: "Paid",
    DeliveryStatus: draft.checkout.DeliveryStatus || "Pending",
    CheckoutDate: draft.checkout.CheckoutDate
      ? new Date(draft.checkout.CheckoutDate)
      : new Date(),
    ProductIDs: draft.checkout.ProductIDs.map((id) => new ObjectId(id)),
  });
  const CheckoutID = checkoutResult.insertedId;

  // 2b. Credit each seller's wallet: one Pending earning per sold product, with
  //     the sale price snapshotted and the platform commission applied. Becomes
  //     withdrawable only after delivery + the hold window (see earning module).
  const soldProductIds = draft.checkout.ProductIDs.map((id) => new ObjectId(id));
  const soldProducts = await productRepository.find({ _id: { $in: soldProductIds } });
  await earningRepository.createForCheckout(
    CheckoutID,
    soldProducts.map((p) => ({ _id: p._id, UserID: p.UserID, Price: p.Price }))
  );

  // 3. Finalize the payment and link the records it produced.
  await paymentRepository.updateById(payment._id!, {
    RazorpayPaymentID: razorpay_payment_id,
    RazorpaySignature: razorpay_signature,
    PaymentMethod,
    PaymentStatus: "Verified",
    PaidAt: new Date(),
    CheckoutID,
    AddressID,
  });

  sendResponse(res, HTTP_STATUS.OK, "Payment verified successfully", {
    CheckoutID,
    AddressID,
  });
});

export const getPaymentsByCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    const payments = await paymentRepository.findByCheckout(req.params.checkoutID);
    sendResponse(res, HTTP_STATUS.OK, "Payments retrieved successfully", payments);
  }
);
