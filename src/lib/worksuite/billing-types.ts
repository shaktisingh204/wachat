import type { ObjectId } from 'mongodb';

/**
 * Worksuite billing types — ported from the Worksuite PHP/Laravel
 * project (Orders, OrderCart, OrderItems, RecurringInvoice,
 * ExpenseRecurring, Promotion).
 *
 * Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   crm_orders, crm_order_items, crm_order_item_images,
 *   crm_recurring_invoices, crm_recurring_invoice_items,
 *   crm_recurring_invoice_item_images,
 *   crm_recurring_expenses, crm_promotions.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WsOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type WsFrequency = 'days' | 'weeks' | 'months' | 'years';

export type WsRecurringStatus = 'active' | 'paused' | 'stopped';

export type WsAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

/* ── Orders ───────────────────────────────────────────────────── */

export type WsOrder = Owned & {
  order_number: string;
  client_id?: ObjectId;
  client_name?: string;
  order_date: Date;
  delivery_date?: Date;
  status: WsOrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  shipping_address?: WsAddress;
  billing_address?: WsAddress;
  notes?: string;
  payment_terms?: string;
  /** Optional denormalized items for snapshot access. */
  items?: WsOrderItem[];
  invoice_id?: ObjectId;
  converted_at?: Date;
};

export type WsOrderItem = {
  _id?: ObjectId;
  order_id?: ObjectId;
  userId?: ObjectId;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_id?: ObjectId;
  tax_rate?: number;
  product_id?: ObjectId;
  hsn_sac_code?: string;
  total: number;
};

export type WsOrderItemImage = Owned & {
  order_item_id: ObjectId;
  url: string;
  filename?: string;
};

/* ── Recurring Invoices ───────────────────────────────────────── */

export type WsRecurringInvoice = Owned & {
  client_id?: ObjectId;
  client_name?: string;
  recurring_start_date: Date;
  next_issue_date: Date;
  frequency: WsFrequency;
  frequency_count: number;
  until_date?: Date;
  stop_at_count?: number;
  issued_count: number;
  status: WsRecurringStatus;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  payment_terms?: string;
  /** Embedded template line items used each time an invoice is issued. */
  items?: WsRecurringInvoiceItem[];
  last_issued_at?: Date;
  generated_invoice_ids?: ObjectId[];
};

export type WsRecurringInvoiceItem = {
  _id?: ObjectId;
  recurring_invoice_id?: ObjectId;
  userId?: ObjectId;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_id?: ObjectId;
  tax_rate?: number;
  product_id?: ObjectId;
  hsn_sac_code?: string;
  total: number;
};

export type WsRecurringInvoiceItemImage = Owned & {
  recurring_invoice_item_id: ObjectId;
  url: string;
  filename?: string;
};

/* ── Recurring Expenses ───────────────────────────────────────── */

export type WsRecurringExpense = Owned & {
  category_id?: ObjectId;
  category_name?: string;
  name: string;
  amount: number;
  currency: string;
  frequency: WsFrequency;
  frequency_count: number;
  start_date: Date;
  next_run_date: Date;
  last_run_date?: Date;
  until_date?: Date;
  stop_at_count?: number;
  run_count: number;
  status: WsRecurringStatus;
  vendor?: string;
  payment_method?: string;
  bank_account_id?: ObjectId;
  notes?: string;
  generated_expense_ids?: ObjectId[];
};

/* ── Promotions / Discount codes ──────────────────────────────── */

export type WsPromotionType = 'percent' | 'fixed';
export type WsPromotionStatus = 'active' | 'inactive';
export type WsPromotionAppliesTo = 'all' | 'category' | 'product';

export type WsPromotion = Owned & {
  code: string;
  description?: string;
  type: WsPromotionType;
  value: number;
  currency?: string;
  start_date?: Date;
  end_date?: Date;
  usage_limit?: number;
  per_customer_limit?: number;
  usage_count?: number;
  applies_to: WsPromotionAppliesTo;
  applies_to_ids?: ObjectId[];
  minimum_subtotal?: number;
  status: WsPromotionStatus;
};
