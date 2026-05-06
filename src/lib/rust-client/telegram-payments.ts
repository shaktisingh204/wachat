import 'server-only';
import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/payments';

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    invoiceId?: string;
    invoiceLink?: string;
}

export interface InvoiceRow {
    _id: string;
    botId: string;
    title: string;
    description: string;
    currency: string;
    amount: number;
    status: string;
    invoiceLink?: string;
    telegramChargeId?: string;
    createdAt: string;
}

export interface ListResp {
    invoices: InvoiceRow[];
    error?: string;
}

export interface CreateBody {
    botId: string;
    title: string;
    description: string;
    currency: string;
    amount: number;
    payload: string;
}

export interface RefundBody {
    botId: string;
    userId: number;
    telegramPaymentChargeId: string;
}

export const telegramPaymentsApi = {
    list: (botId: string) =>
        rustFetch<ListResp>(`${BASE}/?botId=${encodeURIComponent(botId)}`),
    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    refund: (body: RefundBody) =>
        rustFetch<AckResult>(`${BASE}/refund`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),
};
export type TelegramPaymentsApi = typeof telegramPaymentsApi;
