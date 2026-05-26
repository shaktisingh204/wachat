'use server';

/**
 * Server-action wrappers for the Telegram Payments BFF.
 *
 * Each wrapper is a thin pass-through to `rustClient.telegramPayments`,
 * normalizing errors into `{ success, error }` shapes so client
 * components can branch on the result without unwrapping
 * {@link RustApiError}.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AnalyticsQuery,
    AnalyticsResp,
    CreateProviderBody,
    GetPaymentResp,
    InvoiceLinkBody,
    InvoiceRow,
    ListInvoicesResp,
    ListPaymentsQuery,
    ListPaymentsResp,
    ListProvidersResp,
    ListTemplatesResp,
    PaymentRow,
    ProviderRow,
    RefundPaymentBody,
    SendInvoiceBody,
    TemplateRow,
    UpdateProviderBody,
    UpsertTemplateBody,
} from '@/lib/rust-client/telegram-payments';

function asErr(e: unknown): AckResult {
    const msg = e instanceof RustApiError ? e.message : String(e);
    return { success: false, error: msg };
}

// -- Providers ---------------------------------------------------------

export async function listPaymentProvidersAction(
    projectId: string,
): Promise<ListProvidersResp> {
    try {
        return await rustClient.telegramPayments.listProviders(projectId);
    } catch (e) {
        return { providers: [], error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function createPaymentProviderAction(
    body: CreateProviderBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.createProvider(body);
    } catch (e) {
        return asErr(e);
    }
}

export async function updatePaymentProviderAction(
    providerId: string,
    body: UpdateProviderBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.updateProvider(providerId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function deletePaymentProviderAction(
    providerId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.deleteProvider(providerId, projectId);
    } catch (e) {
        return asErr(e);
    }
}

export async function testPaymentProviderAction(
    providerId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.testProvider(providerId, projectId);
    } catch (e) {
        return asErr(e);
    }
}

// -- Templates ---------------------------------------------------------

export async function listPaymentTemplatesAction(
    projectId: string,
): Promise<ListTemplatesResp> {
    try {
        return await rustClient.telegramPayments.listTemplates(projectId);
    } catch (e) {
        return { templates: [], error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function createPaymentTemplateAction(
    body: UpsertTemplateBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.createTemplate(body);
    } catch (e) {
        return asErr(e);
    }
}

export async function updatePaymentTemplateAction(
    templateId: string,
    body: UpsertTemplateBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.updateTemplate(templateId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function deletePaymentTemplateAction(
    templateId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.deleteTemplate(templateId, projectId);
    } catch (e) {
        return asErr(e);
    }
}

// -- Invoices ----------------------------------------------------------

export async function listPaymentInvoicesAction(
    projectId: string,
): Promise<ListInvoicesResp> {
    try {
        return await rustClient.telegramPayments.listInvoices(projectId);
    } catch (e) {
        return { invoices: [], error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function sendPaymentInvoiceAction(
    body: SendInvoiceBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.sendInvoice(body);
    } catch (e) {
        return asErr(e);
    }
}

export async function createPaymentInvoiceLinkAction(
    body: InvoiceLinkBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.createInvoiceLink(body);
    } catch (e) {
        return asErr(e);
    }
}

// -- Payments ----------------------------------------------------------

export async function listPaymentsAction(
    q: ListPaymentsQuery,
): Promise<ListPaymentsResp> {
    try {
        return await rustClient.telegramPayments.listPayments(q);
    } catch (e) {
        return {
            payments: [],
            total: 0,
            page: q.page ?? 1,
            pageSize: q.pageSize ?? 50,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export async function getPaymentAction(
    paymentId: string,
    projectId: string,
): Promise<GetPaymentResp> {
    try {
        return await rustClient.telegramPayments.getPayment(paymentId, projectId);
    } catch (e) {
        return { error: e instanceof RustApiError ? e.message : String(e) };
    }
}

export async function refundPaymentAction(
    paymentId: string,
    body: RefundPaymentBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramPayments.refundPayment(paymentId, body);
    } catch (e) {
        return asErr(e);
    }
}

// -- Analytics ---------------------------------------------------------

export async function paymentAnalyticsAction(
    q: AnalyticsQuery,
): Promise<AnalyticsResp> {
    try {
        return await rustClient.telegramPayments.analytics(q);
    } catch (e) {
        return {
            total: 0,
            successful: 0,
            pending: 0,
            refunded: 0,
            failed: 0,
            by_currency: [],
            top_templates: [],
            by_day: [],
            successRate: 0,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

// -- Bot list (for selectors) ------------------------------------------

export interface BotOption {
    id: string;
    username: string;
    name: string;
}

export async function listProjectBotsForPaymentsAction(
    projectId: string,
): Promise<BotOption[]> {
    try {
        const res = await rustClient.telegramBots.list(projectId);
        return (res.bots ?? []).map((b) => ({
            id: b._id,
            username: b.username,
            name: b.name,
        }));
    } catch {
        return [];
    }
}

// Re-export row types so client components don't need a separate import.
