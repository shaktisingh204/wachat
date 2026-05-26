/**
 * Client for `/v1/sabchat/ad-attribution/*` — ad → chat → revenue
 * attribution surface owned by the `sabchat-ad-attribution` Rust crate.
 * The visitor-side `POST /touch` endpoint at
 * `/v1/sabchat/ad-attribution-public/touch` is called by the embed
 * widget, not by SabNode, and is therefore not wrapped here.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SabChatAdTouch {
    _id: string;
    tenantId: string;
    inboxId: string;
    visitorToken: string;
    contactId?: string;
    conversationId?: string;
    landingUrl?: string;
    referrerUrl?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    ctwaClid?: string;
    gclid?: string;
    fbclid?: string;
    attributedRevenueMinor: number;
    currency?: string;
    createdAt: string;
}

export interface SabChatAdReportRow {
    campaign: string;
    source?: string;
    medium?: string;
    touches: number;
    conversations: number;
    revenueMinor: number;
    currency?: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

export const sabchatAdAttributionApi = {
    listTouches: (
        q: {
            conversationId?: string;
            contactId?: string;
            inboxId?: string;
            utmCampaign?: string;
            limit?: number;
            cursor?: string;
        } = {},
    ) =>
        rustFetch<{ items: SabChatAdTouch[]; nextCursor?: string }>(
            `/v1/sabchat/ad-attribution/touches${qs(q)}`,
        ),

    getTouch: (id: string) => rustFetch<SabChatAdTouch>(`/v1/sabchat/ad-attribution/touches/${id}`),

    attributeRevenue: (body: {
        conversationId: string;
        amountMinor: number;
        currency?: string;
        paymentId?: string;
    }) =>
        rustFetch<{ ok: boolean; touchId?: string; attributedMinor: number }>(
            '/v1/sabchat/ad-attribution/attribute-revenue',
            { method: 'POST', body: JSON.stringify(body) },
        ),

    report: (q: { from?: string; to?: string; groupBy?: 'campaign' | 'source' | 'medium' } = {}) =>
        rustFetch<{ items: SabChatAdReportRow[] }>(`/v1/sabchat/ad-attribution/report${qs(q)}`),
};
