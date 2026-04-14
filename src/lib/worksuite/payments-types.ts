import type { ObjectId } from 'mongodb';

/**
 * Worksuite payments types — ported from the Worksuite PHP/Laravel
 * project (Payment, PaymentGatewayCredentials, OfflinePaymentMethod,
 * BankAccount ext, BankTransaction ext, InvoicePaymentDetail).
 *
 * Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   crm_payments, crm_payment_gateway_credentials,
 *   crm_offline_payment_methods, crm_bank_transactions_ext,
 *   crm_invoice_payment_details.
 *
 * Note: `crm_bank_accounts` already exists — `WsBankAccountExt`
 * simply documents the additional fields patched onto that same
 * collection by `saveBankAccountExt`.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

/* ── Payment ─────────────────────────────────────────────────── */

export type WsPaymentGateway =
  | 'razorpay'
  | 'stripe'
  | 'paypal'
  | 'manual'
  | 'bank-transfer'
  | 'cash'
  | 'cheque'
  | 'upi'
  | 'other';

export type WsPaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

export type WsPayment = Owned & {
  invoice_id?: ObjectId;
  invoice_number?: string;
  client_id?: ObjectId;
  client_name?: string;
  amount: number;
  currency: string;
  paid_on: Date;
  transaction_id?: string;
  gateway: WsPaymentGateway;
  /** Offline payment method id (when gateway is 'manual' / 'other'). */
  offline_method_id?: ObjectId;
  status: WsPaymentStatus;
  remarks?: string;
  bank_account_id?: ObjectId;
  /** Refund metadata — populated when a refund is recorded. */
  refunded_at?: Date;
  refunded_amount?: number;
  refund_reason?: string;
};

/* ── Payment Gateway Credentials ─────────────────────────────── */

export type WsGatewayProvider =
  | 'razorpay'
  | 'stripe'
  | 'paypal'
  | 'payfast'
  | 'paytm'
  | 'mollie'
  | 'authorize_net'
  | 'square';

export type WsGatewayMode = 'test' | 'live';

export type WsPaymentGatewayCredential = Owned & {
  gateway: WsGatewayProvider;
  mode: WsGatewayMode;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  is_active: boolean;
  /** Provider-specific extras (publishable_key, app_id, merchant_id…). */
  extra?: Record<string, any>;
  /** Whether this gateway appears on public invoice/proposal pay pages. */
  show_on_public?: boolean;
};

/* ── Offline Payment Methods ─────────────────────────────────── */

export type WsOfflinePaymentMethod = Owned & {
  name: string;
  description?: string;
  is_active: boolean;
};

/* ── Bank Account extension ──────────────────────────────────── */

/**
 * Extra fields that live on the existing `crm_bank_accounts`
 * collection. We never replace the base record — we patch.
 */
export type WsBankAccountExt = Owned & {
  bank_info?: string;
  branch?: string;
  swift_code?: string;
  iban?: string;
  routing_number?: string;
  opening_balance?: number;
  currency?: string;
};

/* ── Bank Transactions (extended ledger) ─────────────────────── */

export type WsBankTransactionType = 'deposit' | 'withdrawal' | 'transfer';

export type WsBankTransactionExt = Owned & {
  bank_account_id: ObjectId;
  date: Date;
  type: WsBankTransactionType;
  amount: number;
  balance?: number;
  description?: string;
  category?: string;
  reference?: string;
  /** Optional linkage to a payment when the transaction was created
   *  automatically by `recordPayment`. */
  payment_id?: ObjectId;
  reconciled?: boolean;
  reconciled_at?: Date;
};

/* ── Invoice Payment Detail (ledger per payment) ─────────────── */

export type WsInvoicePaymentDetail = Owned & {
  invoice_id: ObjectId;
  payment_id: ObjectId;
  amount_paid: number;
  remaining_balance: number;
  recorded_at: Date;
};

/** Filter shape for `getPayments()` — used by the payments list page. */
export interface ListPaymentsFilter {
  clientId?: string;
  gateway?: string;
  status?: string;
  from?: string;
  to?: string;
  invoiceId?: string;
}
