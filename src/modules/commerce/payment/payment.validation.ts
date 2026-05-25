import Joi from "joi";

// Existing saved address — only the ID is needed.
const existingAddressSchema = Joi.object({
  _id: Joi.string().required(),
}).unknown(false);

// Brand-new address fields.
const newAddressSchema = Joi.object({
  FirstName: Joi.string().required(),
  LastName: Joi.string().required(),
  Country: Joi.string().required(),
  AddressLine1: Joi.string().required(),
  AddressLine2: Joi.string().allow("").optional(),
  City: Joi.string().required(),
  State: Joi.string().required(),
  PostalCode: Joi.string().required(),
  Phone: Joi.string().required(),
  orderNotes: Joi.string().allow("", null).optional(),
  IsDefault: Joi.boolean().optional(),
});

const checkoutSchema = Joi.object({
  ProductIDs: Joi.array().items(Joi.string()).min(1).required(),
  TotalAmount: Joi.number().required(),
  DeliveryStatus: Joi.string().optional(),
  CheckoutDate: Joi.string().optional(),
});

// Order creation carries address + checkout data; nothing is persisted until
// payment is verified. Address can be an existing saved address (pass _id only)
// or a new one (pass full fields — created only on successful payment).
export const createOrderSchema = Joi.object({
  UserID: Joi.string().required(),
  amount: Joi.number().required(),
  currency: Joi.string().optional(),
  address: Joi.alternatives()
    .try(existingAddressSchema, newAddressSchema)
    .required(),
  checkout: checkoutSchema.required(),
});

export const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  PaymentMethod: Joi.string().optional(),
});
