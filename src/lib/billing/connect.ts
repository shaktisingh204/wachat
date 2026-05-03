/**
 * Stripe Connect — marketplace payouts for partners / sabflow developers.
 *
 * Implemented with raw `fetch` against the Stripe REST API rather than the
 * `stripe` SDK so this module can run in edge runtimes and stays decoupled
 * from SDK version drift.
 *
 * Required env: STRIPE_SECRET_KEY.
 */

import type { Currency } from './types';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export interface ConnectedAccount {
    id: string;
    /** Onboarding URL the developer must visit to complete KYC. */
    onboardingUrl?: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
}

export interface TransferResult {
    id: string;
    amountCents: number;
    currency: Currency;
    destination: string;
    created: number;
}

function authHeaders(): Record<string, string> {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error('STRIPE_SECRET_KEY env var is required for Stripe Connect');
    }
    return {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };
}

function form(data: Record<string, string | number | undefined | null>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined || v === null) continue;
        params.append(k, String(v));
    }
    return params.toString();
}

async function stripeFetch<T>(
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
    const headers: Record<string, string> = {
        ...authHeaders(),
        ...((init.headers as Record<string, string>) ?? {}),
    };
    if (init.idempotencyKey) {
        headers['Idempotency-Key'] = init.idempotencyKey;
    }

    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
        ...init,
        headers,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Stripe API ${res.status} on ${path}: ${text}`);
    }
    return (await res.json()) as T;
}

/**
 * Create a Stripe Connect Express account for a partner / developer and
 * return an onboarding link they can complete KYC through.
 */
export async function createConnectedAccount(
    developerId: string,
    country: string,
    opts: { email?: string; refreshUrl?: string; returnUrl?: string } = {},
): Promise<ConnectedAccount> {
    const accountBody = form({
        type: 'express',
        country,
        email: opts.email,
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
        'metadata[developerId]': developerId,
    });

    const account = await stripeFetch<{
        id: string;
        charges_enabled: boolean;
        payouts_enabled: boolean;
    }>('/accounts', {
        method: 'POST',
        body: accountBody,
        idempotencyKey: `connect_acct_${developerId}`,
    });

    let onboardingUrl: string | undefined;
    if (opts.refreshUrl && opts.returnUrl) {
        const linkBody = form({
            account: account.id,
            refresh_url: opts.refreshUrl,
            return_url: opts.returnUrl,
            type: 'account_onboarding',
        });
        const link = await stripeFetch<{ url: string }>('/account_links', {
            method: 'POST',
            body: linkBody,
        });
        onboardingUrl = link.url;
    }

    return {
        id: account.id,
        onboardingUrl,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
    };
}

/**
 * Send a marketplace transfer from the SabNode platform balance to a
 * connected developer / partner account.
 *
 * @param fromTenant   Tenant whose purchase triggered the payout (used in metadata).
 * @param toDeveloperAccount  `acct_...` Stripe Connect account id.
 * @param amount       Amount in minor units (cents/paise).
 */
export async function transfer(
    fromTenant: string,
    toDeveloperAccount: string,
    amount: number,
    currency: Currency,
    opts: { description?: string; idempotencyKey?: string; sourceTransaction?: string } = {},
): Promise<TransferResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error('amount must be a positive integer in minor units');
    }
    if (!toDeveloperAccount.startsWith('acct_')) {
        throw new Error('toDeveloperAccount must be a Stripe Connect account id');
    }

    const body = form({
        amount,
        currency: currency.toLowerCase(),
        destination: toDeveloperAccount,
        description: opts.description,
        source_transaction: opts.sourceTransaction,
        'metadata[fromTenant]': fromTenant,
    });

    const t = await stripeFetch<{
        id: string;
        amount: number;
        currency: string;
        destination: string;
        created: number;
    }>('/transfers', {
        method: 'POST',
        body,
        idempotencyKey: opts.idempotencyKey ?? `transfer_${fromTenant}_${toDeveloperAccount}_${amount}`,
    });

    return {
        id: t.id,
        amountCents: t.amount,
        currency: t.currency.toUpperCase() as Currency,
        destination: t.destination,
        created: t.created,
    };
}
