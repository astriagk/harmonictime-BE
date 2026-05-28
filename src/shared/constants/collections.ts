// Canonical MongoDB collection names — single source of truth.
export const COLLECTIONS = {
  USERS: "Users",
  ROLES: "Roles",
  USER_ROLES: "UserRoles",
  ADDRESS: "Address",

  PRODUCTS: "Products",
  PRODUCT_DESCRIPTION: "ProductDescription",
  PRODUCT_DETAILS: "ProductDetails",
  PRODUCT_IMAGES: "ProductImages",
  DELIVERY_RETURNS: "DeliveryReturns",

  BRANDS: "Brands",
  COLLECTIONS: "Collections",
  CATEGORIES: "Categories",
  RECIPIENTS: "Recipients",
  DIAL_COLORS: "DialColors",
  MOVEMENTS: "Movements",
  STRAP_MATERIALS: "StrapMaterials",
  CASE_MATERIALS: "CaseMaterials",
  WATCH_MARKERS: "WatchMarkers",
  // NOTE: canonical plural — the old code created this as "DeliveryOption" (singular)
  // but the product aggregation read "DeliveryOptions". Standardised to plural here.
  DELIVERY_OPTIONS: "DeliveryOptions",

  CART: "Cart",
  WISHLIST: "Wishlist",
  RECENTLY_VIEWED: "RecentlyViewedProducts",

  CHECKOUT: "Checkout",
  CHECKOUT_ITEMS: "CheckoutItems",
  PAYMENTS: "Payments",
  SHIPMENTS: "Shipments",
  SALES: "Sales",
  OFFERS: "Offers",

  REVIEWS: "Reviews",
  USER_REVIEWS: "UserReviews",

  // Settlement: seller wallet ledger, payout destinations & payout history.
  SELLER_EARNINGS: "SellerEarnings",
  SELLER_BANK_ACCOUNTS: "SellerBankAccounts",
  WITHDRAWALS: "Withdrawals",

  SITE_CONTENT: "SiteContent",
  CONTACT_MESSAGES: "ContactMessages",

  CHAT_THREADS: "ChatThreads",
  CHAT_MESSAGES: "ChatMessages",

  SELLER_GST_DETAILS: "SellerGSTDetails",
} as const;
