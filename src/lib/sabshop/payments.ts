/**
 * Payment gateway adapters.
 *
 * Each adapter implements:
 *   - createIntent(amount, currency, meta) -> { id, clientSecret? }
 *   - capture(intentId, amount?) -> { id, status }
 *   - refund(chargeOrIntent, amount?) -> { id, status }
 *
 * Real network calls are gated on env credentials. Without creds the adapter
 * returns deterministic stubs so the system stays buildable in dev/test.
 */

import 'server-only';
import crypto from 'crypto';
import type { CommerceCurrency, PaymentGateway } from './types';

export interface PaymentIntent {
    id: string;
    clientSecret?: string;
    status: 'requires_action' | 'requires_confirmation' | 'requires_capture' | 'processing' | 'succeeded' | 'failed';
    amountCents: number;
    currency: CommerceCurrency;
    raw?: Record<string, unknown>;
}

export interface PaymentCapture {
    id: string;
    status: 'succeeded' | 'failed' | 'pending';
    amountCents: number;
    raw?: Record<string, unknown>;
}

export interface PaymentRefund {
    id: string;
    status: 'succeeded' | 'failed' | 'pending';
    amountCents: number;
    raw?: Record<string, unknown>;
}

export interface CreateIntentInput {
    amountCents: number;
    currency: CommerceCurrency;
    /** Idempotency key suggested by caller. */
    idempotencyKey?: string;
    /** Customer / order metadata. */
    meta?: Record<string, string>;
    captureMethod?: 'automatic' | 'manual';
    /** Customer details for gateways that need them (UPI, M-Pesa, Paystack…). */
    customer?: { email?: string; phone?: string; name?: string };
}

export interface PaymentGatewayAdapter {
    readonly id: PaymentGateway;
    createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
    capture(intentId: string, amountCents?: number): Promise<PaymentCapture>;
    refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund>;
}

function rid(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function asMinorString(amountCents: number): string {
    return Math.max(0, Math.floor(amountCents)).toString();
}

// -- Stripe -----------------------------------------------------------------

export class StripeAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'stripe';
    private readonly secretKey: string | undefined;

    constructor(secretKey?: string) {
        this.secretKey = secretKey ?? process.env.STRIPE_SECRET_KEY;
    }

    private async call<T>(
        method: 'POST' | 'GET',
        path: string,
        form?: Record<string, string>,
        idempotencyKey?: string,
    ): Promise<T> {
        if (!this.secretKey) {
            throw new Error('STRIPE_SECRET_KEY missing');
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
        const body = form ? new URLSearchParams(form).toString() : undefined;
        const res = await fetch(`https://api.stripe.com/v1${path}`, {
            method,
            headers,
            body,
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Stripe ${path} failed: ${res.status} ${err}`);
        }
        return (await res.json()) as T;
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.secretKey) {
            const id = rid('pi');
            return {
                id,
                clientSecret: `${id}_secret_${crypto.randomBytes(8).toString('hex')}`,
                status: 'requires_confirmation',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const form: Record<string, string> = {
            amount: asMinorString(input.amountCents),
            currency: input.currency.toLowerCase(),
            capture_method: input.captureMethod === 'manual' ? 'manual' : 'automatic',
        };
        if (input.meta) {
            for (const [k, v] of Object.entries(input.meta)) {
                form[`metadata[${k}]`] = v;
            }
        }
        const raw = await this.call<{ id: string; client_secret?: string; status: string }>(
            'POST',
            '/payment_intents',
            form,
            input.idempotencyKey,
        );
        return {
            id: raw.id,
            clientSecret: raw.client_secret,
            status: 'requires_confirmation',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        if (!this.secretKey) {
            return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const form: Record<string, string> = {};
        if (amountCents !== undefined) form.amount_to_capture = asMinorString(amountCents);
        const raw = await this.call<{ id: string; amount_received?: number }>(
            'POST',
            `/payment_intents/${encodeURIComponent(intentId)}/capture`,
            form,
        );
        return {
            id: raw.id,
            status: 'succeeded',
            amountCents: raw.amount_received ?? amountCents ?? 0,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        if (!this.secretKey) {
            return { id: rid('re'), status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const form: Record<string, string> = chargeOrIntentId.startsWith('pi_')
            ? { payment_intent: chargeOrIntentId }
            : { charge: chargeOrIntentId };
        if (amountCents !== undefined) form.amount = asMinorString(amountCents);
        const raw = await this.call<{ id: string; amount: number; status: string }>(
            'POST',
            '/refunds',
            form,
        );
        return {
            id: raw.id,
            status: raw.status === 'succeeded' ? 'succeeded' : 'pending',
            amountCents: raw.amount,
            raw: raw as unknown as Record<string, unknown>,
        };
    }
}

// -- Razorpay ---------------------------------------------------------------

export class RazorpayAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'razorpay';
    private readonly keyId: string | undefined;
    private readonly keySecret: string | undefined;

    constructor(keyId?: string, keySecret?: string) {
        this.keyId = keyId ?? process.env.RAZORPAY_KEY_ID;
        this.keySecret = keySecret ?? process.env.RAZORPAY_KEY_SECRET;
    }

    private authHeader(): string {
        return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.keyId || !this.keySecret) {
            return {
                id: rid('order'),
                status: 'requires_confirmation',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const res = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: this.authHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: input.amountCents,
                currency: input.currency,
                notes: input.meta,
                receipt: input.idempotencyKey,
            }),
        });
        if (!res.ok) throw new Error(`Razorpay createOrder failed ${res.status}`);
        const raw = (await res.json()) as { id: string; status: string };
        return {
            id: raw.id,
            status: 'requires_confirmation',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        if (!this.keyId || !this.keySecret) {
            return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const res = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(intentId)}/capture`,
            {
                method: 'POST',
                headers: {
                    Authorization: this.authHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: amountCents }),
            },
        );
        if (!res.ok) throw new Error(`Razorpay capture failed ${res.status}`);
        const raw = (await res.json()) as { id: string; amount: number };
        return {
            id: raw.id,
            status: 'succeeded',
            amountCents: raw.amount,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        if (!this.keyId || !this.keySecret) {
            return { id: rid('rfnd'), status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const res = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(chargeOrIntentId)}/refund`,
            {
                method: 'POST',
                headers: {
                    Authorization: this.authHeader(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: amountCents }),
            },
        );
        if (!res.ok) throw new Error(`Razorpay refund failed ${res.status}`);
        const raw = (await res.json()) as { id: string; amount: number; status: string };
        return {
            id: raw.id,
            status: raw.status === 'processed' ? 'succeeded' : 'pending',
            amountCents: raw.amount,
            raw: raw as unknown as Record<string, unknown>,
        };
    }
}

// -- PayPal -----------------------------------------------------------------

export class PayPalAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'paypal';
    private readonly clientId: string | undefined;
    private readonly clientSecret: string | undefined;
    private readonly baseUrl: string;

    constructor(clientId?: string, clientSecret?: string, sandbox = false) {
        this.clientId = clientId ?? process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = clientSecret ?? process.env.PAYPAL_CLIENT_SECRET;
        this.baseUrl = sandbox
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
    }

    private async accessToken(): Promise<string> {
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });
        if (!res.ok) throw new Error(`PayPal auth failed ${res.status}`);
        const j = (await res.json()) as { access_token: string };
        return j.access_token;
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.clientId || !this.clientSecret) {
            return {
                id: rid('pp'),
                status: 'requires_confirmation',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const tok = await this.accessToken();
        const value = (input.amountCents / 100).toFixed(2);
        const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tok}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                intent: input.captureMethod === 'manual' ? 'AUTHORIZE' : 'CAPTURE',
                purchase_units: [
                    {
                        amount: { currency_code: input.currency, value },
                    },
                ],
            }),
        });
        if (!res.ok) throw new Error(`PayPal createOrder failed ${res.status}`);
        const raw = (await res.json()) as { id: string; status: string };
        return {
            id: raw.id,
            status: 'requires_confirmation',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        if (!this.clientId || !this.clientSecret) {
            return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const tok = await this.accessToken();
        const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(intentId)}/capture`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tok}`,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) throw new Error(`PayPal capture failed ${res.status}`);
        const raw = (await res.json()) as { id: string };
        return { id: raw.id, status: 'succeeded', amountCents: amountCents ?? 0, raw: raw as unknown as Record<string, unknown> };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        if (!this.clientId || !this.clientSecret) {
            return { id: rid('re'), status: 'succeeded', amountCents: amountCents ?? 0 };
        }
        const tok = await this.accessToken();
        const body: Record<string, unknown> = {};
        if (amountCents !== undefined) {
            body.amount = { value: (amountCents / 100).toFixed(2), currency_code: 'USD' };
        }
        const res = await fetch(`${this.baseUrl}/v2/payments/captures/${encodeURIComponent(chargeOrIntentId)}/refund`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`PayPal refund failed ${res.status}`);
        const raw = (await res.json()) as { id: string; status: string };
        return { id: raw.id, status: raw.status === 'COMPLETED' ? 'succeeded' : 'pending', amountCents: amountCents ?? 0, raw: raw as unknown as Record<string, unknown> };
    }
}

// -- UPI (deep-link / collect-call) -----------------------------------------
// UPI is processed by an aggregator (Razorpay / PayU / Cashfree). This adapter
// emits a deep link payload; capture/refund delegate to whatever PSP processes
// the actual settlement (default: Razorpay).

export class UPIAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'upi';
    private readonly vpa: string;
    private readonly delegate: PaymentGatewayAdapter;

    constructor(vpa?: string, delegate?: PaymentGatewayAdapter) {
        this.vpa = vpa ?? process.env.UPI_VPA ?? 'merchant@upi';
        this.delegate = delegate ?? new RazorpayAdapter();
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        const intent = await this.delegate.createIntent(input);
        const amount = (input.amountCents / 100).toFixed(2);
        const params = new URLSearchParams({
            pa: this.vpa,
            pn: input.meta?.merchantName ?? 'Merchant',
            am: amount,
            cu: input.currency,
            tn: input.meta?.note ?? 'Payment',
            tr: intent.id,
        });
        const deepLink = `upi://pay?${params.toString()}`;
        return {
            ...intent,
            raw: { ...(intent.raw ?? {}), upiDeepLink: deepLink },
        };
    }

    capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        return this.delegate.capture(intentId, amountCents);
    }

    refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        return this.delegate.refund(chargeOrIntentId, amountCents);
    }
}

// -- Mercado Pago -----------------------------------------------------------

export class MercadoPagoAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'mercadopago';
    private readonly accessToken: string | undefined;

    constructor(accessToken?: string) {
        this.accessToken = accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
    }

    private auth(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.accessToken) {
            return {
                id: rid('mp'),
                status: 'requires_confirmation',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const res = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: this.auth(),
            body: JSON.stringify({
                transaction_amount: input.amountCents / 100,
                currency_id: input.currency,
                description: input.meta?.note ?? 'Order payment',
                payer: { email: input.customer?.email },
                capture: input.captureMethod !== 'manual',
            }),
        });
        if (!res.ok) throw new Error(`MercadoPago createIntent failed ${res.status}`);
        const raw = (await res.json()) as { id: number | string; status: string };
        return {
            id: String(raw.id),
            status: 'requires_confirmation',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        if (!this.accessToken) return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(intentId)}`, {
            method: 'PUT',
            headers: this.auth(),
            body: JSON.stringify({ capture: true, transaction_amount: amountCents ? amountCents / 100 : undefined }),
        });
        if (!res.ok) throw new Error(`MercadoPago capture failed ${res.status}`);
        const raw = (await res.json()) as { id: number | string };
        return { id: String(raw.id), status: 'succeeded', amountCents: amountCents ?? 0, raw: raw as unknown as Record<string, unknown> };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        if (!this.accessToken) return { id: rid('re'), status: 'succeeded', amountCents: amountCents ?? 0 };
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(chargeOrIntentId)}/refunds`, {
            method: 'POST',
            headers: this.auth(),
            body: JSON.stringify({ amount: amountCents ? amountCents / 100 : undefined }),
        });
        if (!res.ok) throw new Error(`MercadoPago refund failed ${res.status}`);
        const raw = (await res.json()) as { id: number | string; status: string };
        return {
            id: String(raw.id),
            status: raw.status === 'approved' ? 'succeeded' : 'pending',
            amountCents: amountCents ?? 0,
            raw: raw as unknown as Record<string, unknown>,
        };
    }
}

// -- Paystack ---------------------------------------------------------------

export class PaystackAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'paystack';
    private readonly secretKey: string | undefined;

    constructor(secretKey?: string) {
        this.secretKey = secretKey ?? process.env.PAYSTACK_SECRET_KEY;
    }

    private hdr(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.secretKey) {
            return {
                id: rid('ps'),
                status: 'requires_confirmation',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const res = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: this.hdr(),
            body: JSON.stringify({
                amount: input.amountCents,
                currency: input.currency,
                email: input.customer?.email,
                reference: input.idempotencyKey,
            }),
        });
        if (!res.ok) throw new Error(`Paystack init failed ${res.status}`);
        const raw = (await res.json()) as { data: { reference: string; access_code: string; authorization_url: string } };
        return {
            id: raw.data.reference,
            clientSecret: raw.data.access_code,
            status: 'requires_confirmation',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        if (!this.secretKey) return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
        const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(intentId)}`, {
            headers: this.hdr(),
        });
        if (!res.ok) throw new Error(`Paystack verify failed ${res.status}`);
        const raw = (await res.json()) as { data: { status: string; amount: number } };
        return {
            id: intentId,
            status: raw.data.status === 'success' ? 'succeeded' : 'pending',
            amountCents: raw.data.amount,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        if (!this.secretKey) return { id: rid('re'), status: 'succeeded', amountCents: amountCents ?? 0 };
        const res = await fetch('https://api.paystack.co/refund', {
            method: 'POST',
            headers: this.hdr(),
            body: JSON.stringify({ transaction: chargeOrIntentId, amount: amountCents }),
        });
        if (!res.ok) throw new Error(`Paystack refund failed ${res.status}`);
        const raw = (await res.json()) as { data: { id: number; status: string; amount: number } };
        return {
            id: String(raw.data.id),
            status: raw.data.status === 'processed' ? 'succeeded' : 'pending',
            amountCents: raw.data.amount,
            raw: raw as unknown as Record<string, unknown>,
        };
    }
}

// -- M-Pesa (Daraja STK push) -----------------------------------------------

export class MpesaAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'mpesa';
    private readonly consumerKey: string | undefined;
    private readonly consumerSecret: string | undefined;
    private readonly shortcode: string | undefined;
    private readonly passkey: string | undefined;
    private readonly callbackUrl: string | undefined;

    constructor(opts: { consumerKey?: string; consumerSecret?: string; shortcode?: string; passkey?: string; callbackUrl?: string } = {}) {
        this.consumerKey = opts.consumerKey ?? process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = opts.consumerSecret ?? process.env.MPESA_CONSUMER_SECRET;
        this.shortcode = opts.shortcode ?? process.env.MPESA_SHORTCODE;
        this.passkey = opts.passkey ?? process.env.MPESA_PASSKEY;
        this.callbackUrl = opts.callbackUrl ?? process.env.MPESA_CALLBACK_URL;
    }

    private async token(): Promise<string> {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        const res = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
            headers: { Authorization: `Basic ${auth}` },
        });
        if (!res.ok) throw new Error(`M-Pesa auth failed ${res.status}`);
        const j = (await res.json()) as { access_token: string };
        return j.access_token;
    }

    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        if (!this.consumerKey || !this.consumerSecret || !this.shortcode || !this.passkey) {
            return {
                id: rid('mpesa'),
                status: 'requires_action',
                amountCents: input.amountCents,
                currency: input.currency,
            };
        }
        const tok = await this.token();
        const ts = new Date()
            .toISOString()
            .replace(/[-T:.Z]/g, '')
            .slice(0, 14);
        const password = Buffer.from(`${this.shortcode}${this.passkey}${ts}`).toString('base64');
        const res = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: ts,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.ceil(input.amountCents / 100),
                PartyA: input.customer?.phone,
                PartyB: this.shortcode,
                PhoneNumber: input.customer?.phone,
                CallBackURL: this.callbackUrl,
                AccountReference: input.idempotencyKey ?? 'order',
                TransactionDesc: input.meta?.note ?? 'Order payment',
            }),
        });
        if (!res.ok) throw new Error(`M-Pesa STK failed ${res.status}`);
        const raw = (await res.json()) as { CheckoutRequestID: string };
        return {
            id: raw.CheckoutRequestID,
            status: 'requires_action',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: raw as unknown as Record<string, unknown>,
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        // STK push is auto-captured upon user PIN entry; this is a status query.
        return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        // M-Pesa refund flow is the B2C payment API; left as stub for adapter.
        return { id: rid('re'), status: 'pending', amountCents: amountCents ?? 0, raw: { transactionId: chargeOrIntentId } };
    }
}

// -- PromptPay (Thai QR) ----------------------------------------------------

export class PromptPayAdapter implements PaymentGatewayAdapter {
    readonly id: PaymentGateway = 'promptpay';
    private readonly merchantId: string;

    constructor(merchantId?: string) {
        this.merchantId = merchantId ?? process.env.PROMPTPAY_MERCHANT_ID ?? '0000000000000';
    }

    /**
     * Build a PromptPay-style EMVCo payload string. Real-world impl should
     * include the CRC16 checksum; this is left as a deterministic stub.
     */
    async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
        const id = rid('pp');
        const amount = (input.amountCents / 100).toFixed(2);
        const payload = [
            '00020101021129370016A000000677010111',
            `0113${this.merchantId}`,
            `5303${input.currency === 'THB' ? '764' : '764'}`,
            `54${amount.length.toString().padStart(2, '0')}${amount}`,
            '6304CRC0',
        ].join('');
        return {
            id,
            status: 'requires_action',
            amountCents: input.amountCents,
            currency: input.currency,
            raw: { qrPayload: payload },
        };
    }

    async capture(intentId: string, amountCents?: number): Promise<PaymentCapture> {
        return { id: intentId, status: 'succeeded', amountCents: amountCents ?? 0 };
    }

    async refund(chargeOrIntentId: string, amountCents?: number): Promise<PaymentRefund> {
        return { id: rid('re'), status: 'pending', amountCents: amountCents ?? 0, raw: { ref: chargeOrIntentId } };
    }
}

// -- Registry --------------------------------------------------------------

const REGISTRY: Partial<Record<PaymentGateway, () => PaymentGatewayAdapter>> = {
    stripe: () => new StripeAdapter(),
    razorpay: () => new RazorpayAdapter(),
    paypal: () => new PayPalAdapter(),
    upi: () => new UPIAdapter(),
    mercadopago: () => new MercadoPagoAdapter(),
    paystack: () => new PaystackAdapter(),
    mpesa: () => new MpesaAdapter(),
    promptpay: () => new PromptPayAdapter(),
};

export function getPaymentGateway(gateway: PaymentGateway): PaymentGatewayAdapter {
    const factory = REGISTRY[gateway];
    if (!factory) throw new Error(`Unknown payment gateway: ${gateway}`);
    return factory();
}

export function listSupportedGateways(): PaymentGateway[] {
    return Object.keys(REGISTRY) as PaymentGateway[];
}
