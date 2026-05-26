/**
 * Commerce & Catalog — Shared Types
 *
 * Multi-tenant e-commerce primitives. Monetary amounts are integer minor units
 * (cents/paise) to avoid floating-point drift across gateways.
 */

export type CommerceCurrency =
    | 'USD'
    | 'EUR'
    | 'GBP'
    | 'INR'
    | 'AUD'
    | 'CAD'
    | 'SGD'
    | 'AED'
    | 'JPY'
    | 'BRL'
    | 'MXN'
    | 'NGN'
    | 'KES'
    | 'ZAR'
    | 'THB';

export type ProductKind = 'physical' | 'digital' | 'service' | 'bundle';

export interface ProductVariantOption {
    name: string;
    value: string;
}

export interface Variant {
    id: string;
    sku: string;
    /** Display name e.g. "Red / Large". */
    title?: string;
    options: ProductVariantOption[];
    priceCents: number;
    /** Optional sale/compare-at price (must be >= priceCents). */
    compareAtCents?: number;
    weightGrams?: number;
    barcode?: string;
    imageUrl?: string;
    /** Per-variant default warehouse for inventory snapshot. */
    defaultWarehouseId?: string;
    /** Cached total stock across warehouses (computed). */
    stockTotal?: number;
    /** Soft-delete marker for variant only. */
    archived?: boolean;
}

export interface BundleComponent {
    productId: string;
    variantId?: string;
    /** Quantity of the component required to fulfill 1 bundle. */
    quantity: number;
}

export interface DigitalAsset {
    /** Public/signed URL for download fulfillment. */
    url: string;
    /** Bytes. */
    sizeBytes?: number;
    contentType?: string;
    /** Max downloads allowed per order. */
    maxDownloads?: number;
    /** License key template, e.g. {{key}} expands to a generated string. */
    licenseTemplate?: string;
}

export interface Product {
    _id?: string;
    tenantId: string;
    /** Stable handle / slug. */
    slug: string;
    title: string;
    description?: string;
    kind: ProductKind;
    currency: CommerceCurrency;
    /** Default price; variants may override. */
    priceCents: number;
    compareAtCents?: number;
    /** Top-level SKU (also unique per tenant). */
    sku?: string;
    /** Multi-variant catalog. Empty array = simple product. */
    variants: Variant[];
    /** When kind === 'bundle', list of component products. */
    bundle?: BundleComponent[];
    /** When kind === 'digital'. */
    digital?: DigitalAsset;
    /** Tax category id (links to Tax). */
    taxClassId?: string;
    /** Loose tags for filtering. */
    tags?: string[];
    /** Category / collection ids. */
    categoryIds?: string[];
    images?: string[];
    /** SEO. */
    seoTitle?: string;
    seoDescription?: string;
    /** Soft-delete. Excluded from listings; SKU still considered taken. */
    deletedAt?: string;
    createdAt: string;
    updatedAt: string;
    /** Publication state. */
    status: 'draft' | 'active' | 'archived';
}

export interface Inventory {
    _id?: string;
    tenantId: string;
    productId: string;
    variantId?: string;
    warehouseId: string;
    /** On-hand units; may go negative if backorder allowed. */
    stock: number;
    /** Reserved by carts/pending orders. */
    reserved: number;
    /** Reorder threshold for alerts. */
    reorderLevel?: number;
    /** Allow sales when stock <= 0. */
    backorderAllowed?: boolean;
    updatedAt: string;
}

export interface Address {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
}

export interface LineItem {
    productId: string;
    variantId?: string;
    sku: string;
    title: string;
    quantity: number;
    /** Unit price (post-variant, pre-discount). */
    unitPriceCents: number;
    /** Discount applied to this line in minor units. */
    discountCents: number;
    /** Tax applied to this line in minor units. */
    taxCents: number;
    /** quantity * unitPriceCents - discount + tax (cached). */
    totalCents: number;
    imageUrl?: string;
    /** Per-line tax class for downstream re-computation. */
    taxClassId?: string;
}

export interface OrderItem extends LineItem {
    /** Fulfillment tracking. */
    fulfilledQuantity: number;
    refundedQuantity: number;
    /** Snapshot of digital asset at order time, if any. */
    digital?: DigitalAsset;
}

export interface Cart {
    _id?: string;
    tenantId: string;
    /** Customer id (logged-in) or anonymous session id. */
    customerId?: string;
    sessionId?: string;
    currency: CommerceCurrency;
    items: LineItem[];
    couponCode?: string;
    discountCents: number;
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    shippingAddress?: Address;
    billingAddress?: Address;
    /** Selected shipping rate id from rate-shop. */
    shippingRateId?: string;
    /** Auto-expiry ISO timestamp. */
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
}

export type PaymentStatus =
    | 'pending'
    | 'authorized'
    | 'captured'
    | 'failed'
    | 'refunded'
    | 'partially_refunded'
    | 'canceled';

export type PaymentGateway =
    | 'stripe'
    | 'razorpay'
    | 'paypal'
    | 'upi'
    | 'mercadopago'
    | 'paystack'
    | 'mpesa'
    | 'promptpay';

export interface Payment {
    _id?: string;
    tenantId: string;
    orderId: string;
    gateway: PaymentGateway;
    /** Provider intent / charge id. */
    providerIntentId?: string;
    providerChargeId?: string;
    status: PaymentStatus;
    amountCents: number;
    currency: CommerceCurrency;
    /** Capture later vs immediate. */
    captureMethod: 'automatic' | 'manual';
    /** ISO. */
    createdAt: string;
    capturedAt?: string;
    failedAt?: string;
    /** Last error reason. */
    error?: string;
    /** Provider response blob — diagnostic only. */
    raw?: Record<string, unknown>;
}

export interface Refund {
    _id?: string;
    tenantId: string;
    orderId: string;
    paymentId: string;
    amountCents: number;
    currency: CommerceCurrency;
    reason?: string;
    status: 'pending' | 'succeeded' | 'failed';
    providerRefundId?: string;
    createdAt: string;
    settledAt?: string;
}

export type ShipmentStatus =
    | 'label_purchased'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'returned'
    | 'lost'
    | 'cancelled';

export interface Shipment {
    _id?: string;
    tenantId: string;
    orderId: string;
    carrier: string;
    service: string;
    trackingNumber?: string;
    trackingUrl?: string;
    labelUrl?: string;
    status: ShipmentStatus;
    /** Items shipped (productId + variant + qty). */
    items: Array<{ productId: string; variantId?: string; quantity: number }>;
    fromAddress: Address;
    toAddress: Address;
    /** Cents charged for the label. */
    costCents: number;
    currency: CommerceCurrency;
    createdAt: string;
    deliveredAt?: string;
}

export type OrderStatus =
    | 'pending'
    | 'paid'
    | 'fulfilling'
    | 'fulfilled'
    | 'partially_fulfilled'
    | 'cancelled'
    | 'refunded'
    | 'partially_refunded';

export interface Order {
    _id?: string;
    tenantId: string;
    /** Human readable order number, e.g. ORD-2026-00042. */
    number: string;
    customerId?: string;
    email: string;
    currency: CommerceCurrency;
    items: OrderItem[];
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    couponCode?: string;
    shippingAddress?: Address;
    billingAddress?: Address;
    status: OrderStatus;
    payment?: Payment;
    refunds: Refund[];
    shipments: Shipment[];
    /** Loyalty points earned by this order. */
    loyaltyEarned?: number;
    /** Loyalty points burned to discount this order. */
    loyaltyBurned?: number;
    /** Gift cards applied to this order. */
    giftCardCodes?: string[];
    /** Source / channel — pos, web, mobile, marketplace. */
    channel?: string;
    notes?: string;
    placedAt: string;
    updatedAt: string;
    cancelledAt?: string;
}

export interface LoyaltyPoint {
    _id?: string;
    tenantId: string;
    customerId: string;
    /** Positive = earn, negative = burn. */
    delta: number;
    /** Running balance after this entry. */
    balance: number;
    reason: 'order_earn' | 'order_burn' | 'manual_adjust' | 'expiry' | 'signup_bonus';
    orderId?: string;
    /** Point expiry. */
    expiresAt?: string;
    createdAt: string;
}

export interface GiftCard {
    _id?: string;
    tenantId: string;
    code: string;
    /** Initial issue value. */
    initialBalanceCents: number;
    /** Remaining balance after redemptions. */
    balanceCents: number;
    currency: CommerceCurrency;
    issuedTo?: string;
    issuedBy?: string;
    expiresAt?: string;
    /** Append-only redemption log. */
    redemptions: Array<{ orderId: string; amountCents: number; redeemedAt: string }>;
    status: 'active' | 'redeemed' | 'expired' | 'cancelled';
    createdAt: string;
}

export type SubscriptionInterval = 'day' | 'week' | 'month' | 'year';

export interface Subscription {
    _id?: string;
    tenantId: string;
    customerId: string;
    productId: string;
    variantId?: string;
    interval: SubscriptionInterval;
    intervalCount: number;
    priceCents: number;
    currency: CommerceCurrency;
    status: 'active' | 'paused' | 'cancelled' | 'past_due' | 'completed';
    startsAt: string;
    /** Next charge date. */
    nextBillingAt: string;
    /** End date if fixed-term. */
    endsAt?: string;
    /** Number of billings remaining (-1 = unlimited). */
    cyclesRemaining: number;
    paymentMethodId?: string;
    /** Cached schedule for upcoming invoices. */
    schedule?: Array<{ date: string; amountCents: number; cycleNumber: number }>;
    cancelAtPeriodEnd?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Tax {
    _id?: string;
    tenantId: string;
    /** Class id used by products. */
    classId: string;
    name: string;
    /** Rate as fraction, e.g. 0.18 for 18%. */
    rate: number;
    /** ISO 3166-1 alpha-2. */
    country?: string;
    /** State / province code. */
    region?: string;
    /** Whether `rate` is already included in the price (VAT-style). */
    inclusive?: boolean;
    /** Compound on top of other taxes. */
    compound?: boolean;
}

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping' | 'bxgy';

export interface Coupon {
    _id?: string;
    tenantId: string;
    code: string;
    discountType: CouponDiscountType;
    /** Percent (0..100) or fixed minor units depending on discountType. */
    value: number;
    currency?: CommerceCurrency;
    /** Minimum cart subtotal to qualify. */
    minSubtotalCents?: number;
    /** Restrict to product or category ids. */
    appliesToProductIds?: string[];
    appliesToCategoryIds?: string[];
    /** Buy-X-Get-Y config. */
    bxgy?: { buyQuantity: number; getQuantity: number; getDiscountPercent: number };
    maxRedemptions?: number;
    timesRedeemed: number;
    /** Per-customer limit. */
    perCustomerLimit?: number;
    startsAt?: string;
    expiresAt?: string;
    active: boolean;
    createdAt: string;
}

/** Result of cart total computation. */
export interface CartTotals {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    /** Per-line breakdown for UI. */
    lines: LineItem[];
}
