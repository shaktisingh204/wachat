/**
 * Shipping rate-shopping.
 *
 * Defines a unified `ShippingProvider` interface and stub adapters for Shippo,
 * EasyPost, and Shiprocket. Network calls are guarded on env credentials so
 * the module is safe to import in tests.
 */

import 'server-only';
import type { Address, CommerceCurrency, Shipment } from './types';

export interface Parcel {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightGrams: number;
}

export interface ShippingRate {
    id: string;
    carrier: string;
    service: string;
    /** Cents in `currency`. */
    amountCents: number;
    currency: CommerceCurrency;
    estimatedDays?: number;
    /** Provider-specific identifier needed to purchase the label. */
    providerRateId: string;
    provider: 'shippo' | 'easypost' | 'shiprocket';
}

export interface RateRequest {
    from: Address;
    to: Address;
    parcels: Parcel[];
}

export interface PurchasedLabel {
    trackingNumber: string;
    trackingUrl?: string;
    labelUrl: string;
    carrier: string;
    service: string;
    amountCents: number;
    currency: CommerceCurrency;
    raw?: Record<string, unknown>;
}

export interface ShippingProvider {
    readonly id: 'shippo' | 'easypost' | 'shiprocket';
    rates(req: RateRequest): Promise<ShippingRate[]>;
    purchase(rate: ShippingRate, req: RateRequest): Promise<PurchasedLabel>;
    track?(trackingNumber: string): Promise<{ status: Shipment['status']; raw?: Record<string, unknown> }>;
}

// -- Shippo ----------------------------------------------------------------

export class ShippoProvider implements ShippingProvider {
    readonly id = 'shippo' as const;
    private readonly apiKey: string | undefined;

    constructor(apiKey?: string) {
        this.apiKey = apiKey ?? process.env.SHIPPO_API_KEY;
    }

    private hdr(): Record<string, string> {
        return {
            Authorization: `ShippoToken ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    async rates(req: RateRequest): Promise<ShippingRate[]> {
        if (!this.apiKey) return stubRates(this.id, req);
        const res = await fetch('https://api.goshippo.com/shipments/', {
            method: 'POST',
            headers: this.hdr(),
            body: JSON.stringify({
                address_from: addrToShippo(req.from),
                address_to: addrToShippo(req.to),
                parcels: req.parcels.map((p) => ({
                    length: p.lengthCm,
                    width: p.widthCm,
                    height: p.heightCm,
                    distance_unit: 'cm',
                    weight: p.weightGrams,
                    mass_unit: 'g',
                })),
                async: false,
            }),
        });
        if (!res.ok) throw new Error(`Shippo rates failed ${res.status}`);
        const j = (await res.json()) as {
            rates: Array<{ object_id: string; amount: string; currency: string; provider: string; servicelevel: { name: string }; estimated_days?: number }>;
        };
        return j.rates.map((r) => ({
            id: r.object_id,
            carrier: r.provider,
            service: r.servicelevel.name,
            amountCents: Math.round(parseFloat(r.amount) * 100),
            currency: r.currency as CommerceCurrency,
            estimatedDays: r.estimated_days,
            providerRateId: r.object_id,
            provider: 'shippo',
        }));
    }

    async purchase(rate: ShippingRate): Promise<PurchasedLabel> {
        if (!this.apiKey) return stubLabel(rate);
        const res = await fetch('https://api.goshippo.com/transactions/', {
            method: 'POST',
            headers: this.hdr(),
            body: JSON.stringify({ rate: rate.providerRateId, label_file_type: 'PDF', async: false }),
        });
        if (!res.ok) throw new Error(`Shippo purchase failed ${res.status}`);
        const j = (await res.json()) as { tracking_number: string; tracking_url_provider?: string; label_url: string };
        return {
            trackingNumber: j.tracking_number,
            trackingUrl: j.tracking_url_provider,
            labelUrl: j.label_url,
            carrier: rate.carrier,
            service: rate.service,
            amountCents: rate.amountCents,
            currency: rate.currency,
            raw: j as unknown as Record<string, unknown>,
        };
    }
}

// -- EasyPost --------------------------------------------------------------

export class EasyPostProvider implements ShippingProvider {
    readonly id = 'easypost' as const;
    private readonly apiKey: string | undefined;

    constructor(apiKey?: string) {
        this.apiKey = apiKey ?? process.env.EASYPOST_API_KEY;
    }

    private hdr(): Record<string, string> {
        const auth = Buffer.from(`${this.apiKey}:`).toString('base64');
        return {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        };
    }

    async rates(req: RateRequest): Promise<ShippingRate[]> {
        if (!this.apiKey) return stubRates(this.id, req);
        const res = await fetch('https://api.easypost.com/v2/shipments', {
            method: 'POST',
            headers: this.hdr(),
            body: JSON.stringify({
                shipment: {
                    from_address: addrToEasyPost(req.from),
                    to_address: addrToEasyPost(req.to),
                    parcel: {
                        length: req.parcels[0]?.lengthCm,
                        width: req.parcels[0]?.widthCm,
                        height: req.parcels[0]?.heightCm,
                        weight: (req.parcels[0]?.weightGrams ?? 0) / 28.3495, // ounces
                    },
                },
            }),
        });
        if (!res.ok) throw new Error(`EasyPost rates failed ${res.status}`);
        const j = (await res.json()) as {
            rates: Array<{ id: string; carrier: string; service: string; rate: string; currency: string; delivery_days?: number }>;
        };
        return j.rates.map((r) => ({
            id: r.id,
            carrier: r.carrier,
            service: r.service,
            amountCents: Math.round(parseFloat(r.rate) * 100),
            currency: r.currency as CommerceCurrency,
            estimatedDays: r.delivery_days,
            providerRateId: r.id,
            provider: 'easypost',
        }));
    }

    async purchase(rate: ShippingRate): Promise<PurchasedLabel> {
        if (!this.apiKey) return stubLabel(rate);
        // Real impl would POST /shipments/{id}/buy with rate id; stubbed.
        return stubLabel(rate);
    }
}

// -- Shiprocket ------------------------------------------------------------

export class ShiprocketProvider implements ShippingProvider {
    readonly id = 'shiprocket' as const;
    private readonly email: string | undefined;
    private readonly password: string | undefined;
    private cachedToken?: string;

    constructor(email?: string, password?: string) {
        this.email = email ?? process.env.SHIPROCKET_EMAIL;
        this.password = password ?? process.env.SHIPROCKET_PASSWORD;
    }

    private async token(): Promise<string> {
        if (this.cachedToken) return this.cachedToken;
        const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.email, password: this.password }),
        });
        if (!res.ok) throw new Error(`Shiprocket auth failed ${res.status}`);
        const j = (await res.json()) as { token: string };
        this.cachedToken = j.token;
        return j.token;
    }

    async rates(req: RateRequest): Promise<ShippingRate[]> {
        if (!this.email || !this.password) return stubRates(this.id, req);
        const tok = await this.token();
        const url = new URL('https://apiv2.shiprocket.in/v1/external/courier/serviceability/');
        url.searchParams.set('pickup_postcode', req.from.postalCode);
        url.searchParams.set('delivery_postcode', req.to.postalCode);
        url.searchParams.set('weight', String((req.parcels[0]?.weightGrams ?? 0) / 1000));
        url.searchParams.set('cod', '0');
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${tok}` } });
        if (!res.ok) throw new Error(`Shiprocket rates failed ${res.status}`);
        const j = (await res.json()) as {
            data: { available_courier_companies: Array<{ courier_company_id: number; courier_name: string; rate: number; estimated_delivery_days?: string }> };
        };
        return j.data.available_courier_companies.map((c) => ({
            id: String(c.courier_company_id),
            carrier: c.courier_name,
            service: 'standard',
            amountCents: Math.round(c.rate * 100),
            currency: 'INR',
            estimatedDays: c.estimated_delivery_days ? parseInt(c.estimated_delivery_days, 10) : undefined,
            providerRateId: String(c.courier_company_id),
            provider: 'shiprocket',
        }));
    }

    async purchase(rate: ShippingRate): Promise<PurchasedLabel> {
        if (!this.email || !this.password) return stubLabel(rate);
        return stubLabel(rate);
    }
}

// -- Rate-shopping --------------------------------------------------------

export interface RateShopOptions {
    /** If provided, only these providers are queried. */
    providers?: ShippingProvider[];
    /** Sort by 'price' (default), 'speed', or 'carrier'. */
    sortBy?: 'price' | 'speed' | 'carrier';
}

export async function rateShop(req: RateRequest, opts: RateShopOptions = {}): Promise<ShippingRate[]> {
    const providers =
        opts.providers ?? [new ShippoProvider(), new EasyPostProvider(), new ShiprocketProvider()];
    const settled = await Promise.allSettled(providers.map((p) => p.rates(req)));
    const all: ShippingRate[] = [];
    for (const r of settled) {
        if (r.status === 'fulfilled') all.push(...r.value);
    }
    if (opts.sortBy === 'speed') {
        all.sort((a, b) => (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99));
    } else if (opts.sortBy === 'carrier') {
        all.sort((a, b) => a.carrier.localeCompare(b.carrier));
    } else {
        all.sort((a, b) => a.amountCents - b.amountCents);
    }
    return all;
}

export function getShippingProvider(id: ShippingProvider['id']): ShippingProvider {
    switch (id) {
        case 'shippo':
            return new ShippoProvider();
        case 'easypost':
            return new EasyPostProvider();
        case 'shiprocket':
            return new ShiprocketProvider();
    }
}

// -- helpers ---------------------------------------------------------------

function stubRates(provider: ShippingProvider['id'], req: RateRequest): ShippingRate[] {
    const grams = req.parcels.reduce((s, p) => s + p.weightGrams, 0) || 500;
    const baseCents = 500 + Math.floor(grams / 100) * 50;
    return [
        {
            id: `${provider}_economy`,
            carrier: provider,
            service: 'economy',
            amountCents: baseCents,
            currency: 'USD',
            estimatedDays: 7,
            providerRateId: `${provider}_economy`,
            provider,
        },
        {
            id: `${provider}_express`,
            carrier: provider,
            service: 'express',
            amountCents: baseCents * 2,
            currency: 'USD',
            estimatedDays: 2,
            providerRateId: `${provider}_express`,
            provider,
        },
    ];
}

function stubLabel(rate: ShippingRate): PurchasedLabel {
    const tn = `STUB${Date.now().toString(36).toUpperCase()}`;
    return {
        trackingNumber: tn,
        trackingUrl: `https://track.local/${tn}`,
        labelUrl: `https://label.local/${tn}.pdf`,
        carrier: rate.carrier,
        service: rate.service,
        amountCents: rate.amountCents,
        currency: rate.currency,
    };
}

function addrToShippo(a: Address): Record<string, string | undefined> {
    return {
        name: a.name,
        company: a.company,
        street1: a.line1,
        street2: a.line2,
        city: a.city,
        state: a.state,
        zip: a.postalCode,
        country: a.country,
        phone: a.phone,
        email: a.email,
    };
}

function addrToEasyPost(a: Address): Record<string, string | undefined> {
    return {
        name: a.name,
        company: a.company,
        street1: a.line1,
        street2: a.line2,
        city: a.city,
        state: a.state,
        zip: a.postalCode,
        country: a.country,
        phone: a.phone,
        email: a.email,
    };
}
